A very simple equivalent to Tree Style Tab firefox extension.
Without very back hacks like .toSource().replace(...,...),
nor firefox functions overload, ...

Highlight addon-sdk capabilities and how to hack firefox like a gentleman.

You need to patch SDK 1.0rc2 to make it work.
Open "packages/api-utils/content/content-proxy.js"
and replace last function definition with this:

exports.create = function create(object) {
  let xpcWrapper = XPCNativeWrapper(object);
  if (xpcWrapper === object)
    return object;
  return getProxyForObject(xpcWrapper);
}

