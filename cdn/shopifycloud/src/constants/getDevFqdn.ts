export function getDevFqdn(hostname: string) {
  // We need to detect if the code is running on a Spin instance or local dev
  // during run time, for checkout-web. As a result, we can't use the NODE_ENV
  // env variable. We exclude Shop Web from local dev matching as we use it's own
  // environment variable to target right build.
  const isLocalDev = hostname.match(/\.shop\.dev$/);
  const isShopWebDev = hostname === 'web-shop-client.shop.dev';

  if (isLocalDev && !isShopWebDev) return 'shop.dev';

  const spinFqdnMatch = hostname.match(/([^.]*[.]){2}(eu|us|asia).spin.dev/);
  if (!spinFqdnMatch) return undefined;
  if (!spinFqdnMatch.length) return undefined;

  return spinFqdnMatch[0];
}
