import type {RefObject} from 'preact';
import {useCallback} from 'preact/hooks';

import type {
  AuthorizeErrorEvent,
  CompletedEvent,
  CustomFlowSideEffectEvent,
  MessageEventData,
} from '~/types/event';

import {useDispatchEvent} from './useDispatchEvent';

interface UseWindoidMessageHandlerProps {
  handleClose?: () => void;
  handleComplete: (event: CompletedEvent) => void;
  handleError?: (event: AuthorizeErrorEvent) => void;
  handleOpen?: () => void;
  handleCustomFlowSideEffect?: (event: CustomFlowSideEffectEvent) => void;
  windoidRef: RefObject<Window>;
}

export const useWindoidMessageHandler = ({
  handleClose,
  handleComplete,
  handleError,
  handleOpen,
  windoidRef,
  handleCustomFlowSideEffect,
}: UseWindoidMessageHandlerProps) => {
  const dispatchEvent = useDispatchEvent();

  const handleWindoidMessage = useCallback(
    async (payload: MessageEvent<MessageEventData>) => {
      switch (payload.data.type) {
        case 'completed':
          handleComplete(payload.data as any);
          dispatchEvent('completed', payload.data, true);
          windoidRef.current?.close();
          break;
        case 'custom_flow_side_effect':
          handleCustomFlowSideEffect?.(payload.data as any);
          break;
        case 'error':
          handleError?.(payload.data as any);
          dispatchEvent('error', payload.data);
          windoidRef.current?.close();
          break;
        case 'windoidopened':
          dispatchEvent('windoidopened');
          handleOpen?.();
          break;
        case 'close':
        case 'windoidclosed':
          dispatchEvent('windoidclosed');
          handleClose?.();
          windoidRef.current?.close();
          break;
        case 'prequal_buyer_upsert_successful':
          windoidRef.current?.close();
          dispatchEvent('buyerOnboardingSuccess');
          break;
      }
    },
    [
      dispatchEvent,
      handleComplete,
      handleClose,
      handleCustomFlowSideEffect,
      handleError,
      handleOpen,
      windoidRef,
    ],
  );

  return handleWindoidMessage;
};
