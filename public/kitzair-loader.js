/**
 * Kitzair Loader – bindet das Hubschrauber-Berechnungstool per Iframe ein.
 * Nutzung: <script src="https://[IHRE-APP-URL]/kitzair-loader.js" data-kitzair-target="id-des-containers"></script>
 * Optional: data-kitzair-width="100%", data-kitzair-height="800", data-kitzair-min-height="600"
 */
(function () {
  var script = document.currentScript;
  var targetId = script.getAttribute("data-kitzair-target");
  var baseUrl = script.src.replace(/\/kitzair-loader\.js(\?.*)?$/i, "");
  var width = script.getAttribute("data-kitzair-width") || "100%";
  var height = script.getAttribute("data-kitzair-height") || "800px";
  var minHeight = script.getAttribute("data-kitzair-min-height") || "600px";

  var container = targetId ? document.getElementById(targetId) : null;
  if (!container) {
    console.warn("Kitzair Loader: data-kitzair-target nicht gefunden.");
    return;
  }

  var iframe = document.createElement("iframe");
  iframe.src = baseUrl + "/?embed=1";
  iframe.title = "Hubschrauber-Transfer Berechnung";
  iframe.style.width = width;
  iframe.style.height = height;
  iframe.style.minHeight = minHeight;
  iframe.style.border = "none";
  iframe.style.display = "block";
  container.appendChild(iframe);
})();
