function isClient() {
  return (typeof window != 'undefined' && window.document);
}

function isServer() {
  return !isClient();
}

export default {
  isClient,
  isServer,
};
