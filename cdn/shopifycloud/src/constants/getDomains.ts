/* eslint-disable no-process-env */

import {getDevFqdn} from './getDevFqdn';

export function getDomains(location: {origin: string; hostname: string}) {
  const devFqdn = getDevFqdn(location.hostname);
  const isSpin = process.env.NODE_ENV === 'spin';

  if (isSpin && devFqdn) {
    return {
      coreAuthDomain: `https://shop1.shopify.${devFqdn}`,
      payAuthDomain: `https://shop-server.${devFqdn}`,
      payAuthDomainAlt: `https://pay-shopify-com.${devFqdn}`,
    };
  }

  if (devFqdn) {
    return {
      coreAuthDomain: `https://shop1.my.${devFqdn}`,
      payAuthDomain: `https://shop-server.${devFqdn}`,
      payAuthDomainAlt: `https://pay-shopify-com.${devFqdn}`,
    };
  }

  return {
    coreAuthDomain: process.env.CORE_AUTH_DOMAIN || location.origin,
    payAuthDomain: process.env.PAY_AUTH_DOMAIN,
    payAuthDomainAlt: process.env.PAY_AUTH_ALT_DOMAIN,
  };
}
