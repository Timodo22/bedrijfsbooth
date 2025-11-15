import {BugsnagLight} from '@shopify/bugsnag-light-core';
import type {
  BreadcrumbMetadata,
  BreadcrumbType,
  BugsnagEvent,
  BugsnagLightParams,
  Metadata,
  NotifyOptions,
  ReleaseStage,
} from '@shopify/bugsnag-light-core';

import {isoDocument} from '~/utils/document';
import {isoNavigator} from '~/utils/navigator';
import {isoWindow} from '~/utils/window';

import config from '../../config';
import {SendImmediatelyOpenTelemetryClient} from '../OpenTelemetry/SendImmediatelyOpenTelemetryClient';
import {createExporter} from '../OpenTelemetry/utils';

export const MONORAIL_NETWORK_ERROR_BACKPRESSURE_MARKER =
  'Backpressure applied';
export const MONORAIL_NETWORK_ERROR_MARKER =
  'A network failure may have prevented the request from completing';

export const UNACTIONABLE_NETWORK_ERRORS = [
  // Safari
  'Load failed',
  // Chrome
  'Failed to fetch',
  // Firefox
  'when attempting to fetch resource',
];

/**
 * List of broad error classes that are a result of monkey-patching, outdated browsers, etc.
 * Do not include expected runtime errors, but do include errors that would have been caught by CI.
 */
export const UNACTIONABLE_ERROR_CLASSES = [
  'NotFoundError',
  'NotSupportedError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
];

const isDevelopment = ['development', 'spin'].includes(
  // eslint-disable-next-line no-process-env
  process.env.NODE_ENV || '',
);

interface CreateBugsnagParamsProps {
  metadata: Metadata;
  onNetworkError: () => void;
}

/**
 * Copied from https://github.com/Shopify/pos-next-react-native/pull/34603/files#diff-b88d5908387525f48fcb3c152c2d3b91f9075d0f448f9b649a1b64cb09c225aaR169
 * The emitted error is at https://github.com/Shopify/monorail/blob/09fc3e83557e6517c7ec97d1ee1e0e37b3c79ada/lang/typescript/src/producers/producer-errors.ts#L41
 */
const _isMonorailNetworkError = (errorMessage: string | undefined): boolean => {
  return Boolean(
    errorMessage?.includes(MONORAIL_NETWORK_ERROR_MARKER) ||
      errorMessage?.includes(MONORAIL_NETWORK_ERROR_BACKPRESSURE_MARKER),
  );
};

function createBugsnagParams({
  metadata,
  onNetworkError,
}: CreateBugsnagParamsProps): BugsnagLightParams {
  return {
    apiKey: config.bugsnagApiKey,
    appId: 'shop-js',
    appVersion: '__buildVersionBeta',
    onError: (event: BugsnagEvent) => {
      const exception = event.exceptions[0];
      if (!exception) {
        return false;
      }

      const {errorClass, message} = exception;

      const isNetworkError =
        errorClass === 'NetworkError' ||
        UNACTIONABLE_NETWORK_ERRORS.some((networkMessage) =>
          message?.includes(networkMessage),
        ) ||
        _isMonorailNetworkError(message);
      const isInProject = exception.stacktrace.some((st) => st.inProject);
      if (isNetworkError) {
        // Record network errors for Observe, but don't notify Bugsnag
        onNetworkError();
        return false;
      }
      if (!isInProject) {
        // Ignore errors not related to the SDK
        return false;
      }
      if (UNACTIONABLE_ERROR_CLASSES.includes(errorClass)) {
        return false;
      }

      const featureAssets: Record<string, any[]> | undefined =
        isoWindow.Shopify?.featureAssets?.['shop-js'];

      const featureAssetsNonEmpty = Boolean(
        featureAssets && Object.keys(featureAssets).length > 0,
      );

      const shopJsUrls = (
        Array.from(
          isoDocument.querySelectorAll('script[src*="/shop-js/"]'),
        ) as HTMLScriptElement[]
      ).map((scriptTag) => scriptTag.src);

      event.device = {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        locale: isoNavigator.userLanguage || isoNavigator.language,
        userAgent: isoNavigator.userAgent,
        orientation: isoWindow.screen?.orientation?.type,
        time: new Date().toISOString(),
      };

      /**
       * Includes metadata from:
       *  1) the event created by Bugsnag client
       *  2) the metadata passed to the Bugsnag constructor
       *  3) additional default metadata for all events
       */
      event.metaData = {
        ...event.metaData,
        ...metadata,
        custom: {
          ...event.metaData?.custom,
          ...metadata.custom,
          beta: true,
          // eslint-disable-next-line no-process-env
          bundleLocale: process.env.BUILD_LOCALE,
          compactUX: true,
          domain: isoWindow?.location?.hostname,
          shopJsUrls,
          shopJsFeatureAssetsExist: featureAssetsNonEmpty,
        },
      };

      event.request = {
        url: isoWindow.location.href,
      };
    },
    // eslint-disable-next-line no-process-env
    releaseStage: (process.env.NODE_ENV || 'production') as ReleaseStage,
    withSessionTracking: false,
  };
}

export class Bugsnag {
  readonly client: BugsnagLight;
  readonly feature: string;
  readonly opentelClient = new SendImmediatelyOpenTelemetryClient({
    exporter: createExporter(),
  });

  constructor(feature?: string) {
    const params = createBugsnagParams({
      metadata: {
        custom: {
          feature,
        },
      },
      onNetworkError: this.handleNetworkError.bind(this),
    });

    this.client = new BugsnagLight(params);
    this.feature = feature || '';
    this.leaveBreadcrumb = this.leaveBreadcrumb.bind(this);
    this.notify = this.notify.bind(this);
  }

  leaveBreadcrumb(
    name: string,
    metaData: BreadcrumbMetadata,
    type: BreadcrumbType,
  ) {
    if (!this.client) {
      // eslint-disable-next-line no-console
      console.log('Bugsnag.leaveBreadcrumb() called before client creation.');
      return;
    }

    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.log('[Bugsnag leaveBreadcrumb called]', name, metaData, type);
      return;
    }

    this.client.leaveBreadcrumb(name, metaData, type);
  }

  async notify(error: Error, options?: NotifyOptions) {
    if (!this.client) {
      // eslint-disable-next-line no-console
      console.warn?.('Bugsnag.notify() called before client creation.');
      return;
    }

    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.log('[Bugsnag notify called]', error);
      return;
    }

    this.client.notify(error, options);
  }

  handleNetworkError() {
    this.opentelClient.counter({
      attributes: {
        beta: true,
        feature: this.feature,
        error: 'NetworkError',
      },
      name: 'shop_js_network_error',
      value: 1,
    });
  }
}
