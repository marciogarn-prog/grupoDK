/**
 * Canal único: oficial (default). Ambiente demo descontinuado.
 */
(function dkDeployChannel() {
  window.__DK_DEPLOY_CHANNEL__ = "default";
  window.__DK_IS_DEMO_DEPLOY__ = false;
  window.__DK_deploySnapshotLabel = function () {
    return "default";
  };
  try {
    window.dispatchEvent(
      new CustomEvent("dk-deploy-channel-ready", { detail: { channel: "default", isDemo: false } })
    );
  } catch {
    /* ignore */
  }
})();
