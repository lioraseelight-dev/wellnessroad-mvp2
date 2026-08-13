(() => {
  const root = document.getElementById("wellnessroad-gwangalli-map");
  if (!root) return;

  const mapError = root.querySelector(".map-error");
  if (typeof d3 === "undefined" || !window.GWANGALLI_MAP_DATA) {
    if (mapError) mapError.hidden = false;
    return;
  }

  const data = window.GWANGALLI_MAP_DATA;
  const activeRoute = data.route;
  const svg = d3.select(root.querySelector(".route-map"));
  const tableBody = root.querySelector("#stop-table");
  const routeName = root.querySelector("#route-name");
  const routeMetrics = root.querySelector("#route-metrics");
  const routeStatus = root.querySelector("#route-status");
  const routeWarning = root.querySelector("#route-warning");
  const selectedPin = root.querySelector("#selected-pin");
  const selectedPlace = root.querySelector("#selected-place");
  const selectedLocation = root.querySelector("#selected-location");
  const selectedActivity = root.querySelector("#selected-activity");
  const typeColor = {
    start: "--viz-series-1",
    activity: "--viz-series-2",
    rest: "--viz-series-3",
    snack: "--viz-series-4",
    finish: "--viz-series-5"
  };
  const typeSymbol = {
    start: d3.symbolTriangle,
    activity: d3.symbolStar,
    rest: d3.symbolCircle,
    snack: d3.symbolDiamond,
    finish: d3.symbolSquare
  };

  let selectedStop = activeRoute.stops[0];
  let lastProjection = null;
  let resizeFrame = null;

  function themeValue(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  function paddedBounds(route) {
    const bounds = d3.geoBounds(route.line);
    const lonPadding = Math.max((bounds[1][0] - bounds[0][0]) * 0.18, 0.0015);
    const latPadding = Math.max((bounds[1][1] - bounds[0][1]) * 0.7, 0.0025);
    return [
      [bounds[0][0] - lonPadding, bounds[0][1] - latPadding],
      [bounds[1][0] + lonPadding, bounds[1][1] + latPadding]
    ];
  }

  function featureIntersects(feature, bounds) {
    const featureBounds = d3.geoBounds(feature);
    return !(
      featureBounds[1][0] < bounds[0][0] ||
      featureBounds[0][0] > bounds[1][0] ||
      featureBounds[1][1] < bounds[0][1] ||
      featureBounds[0][1] > bounds[1][1]
    );
  }

  function selectStop(stop) {
    selectedStop = stop;
    renderSelectedStop();
  }

  function renderMap() {
    const width = Math.max(root.querySelector(".map-wrap").clientWidth, 320);
    const height = width <= 520 ? 390 : 430;
    const padding = width <= 520 ? 28 : 42;
    const routeCollection = {
      type: "FeatureCollection",
      features: [
        activeRoute.line,
        ...activeRoute.stops.map((stop) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [stop.lon, stop.lat] }
        }))
      ]
    };

    const projection = d3
      .geoMercator()
      .fitExtent(
        [
          [padding, padding],
          [width - padding, height - padding]
        ],
        routeCollection
      )
      .clipExtent([
        [0, 0],
        [width, height]
      ]);

    lastProjection = projection;
    const path = d3.geoPath(projection);
    const bounds = paddedBounds(activeRoute);
    const visibleFeatures = data.basemap.features.filter((feature) =>
      featureIntersects(feature, bounds)
    );

    svg.attr("width", width).attr("height", height).attr("viewBox", "0 0 " + width + " " + height);
    svg.selectAll("*").remove();

    const backgroundOrder = ["water", "beach", "park", "coast", "road-local", "road-major", "walk"];
    for (const kind of backgroundOrder) {
      svg
        .append("g")
        .selectAll("path")
        .data(visibleFeatures.filter((feature) => feature.properties.kind === kind))
        .join("path")
        .attr("class", "map-" + kind)
        .attr("d", path);
    }

    svg.append("path").datum(activeRoute.line).attr("class", "route-halo").attr("d", path);
    svg.append("path").datum(activeRoute.line).attr("class", "route-line").attr("d", path);

    const stopGroups = svg
      .append("g")
      .selectAll("g")
      .data(activeRoute.stops)
      .join("g")
      .attr("class", "stop-group")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", (stop) => stop.no + "번 핀, " + stop.place + ", " + stop.minute + "분")
      .attr("transform", (stop) => {
        const point = projection([stop.lon, stop.lat]);
        return "translate(" + point[0] + "," + point[1] + ")";
      })
      .on("click", (event, stop) => selectStop(stop))
      .on("keydown", (event, stop) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectStop(stop);
        }
      });

    stopGroups
      .append("path")
      .attr("class", "stop-shape")
      .attr("d", (stop) => d3.symbol().type(typeSymbol[stop.type]).size(440)())
      .attr("fill", (stop) =>
        themeValue(typeColor[stop.type]) || "var(" + typeColor[stop.type] + ")"
      );

    stopGroups
      .append("text")
      .attr("class", "stop-number")
      .attr("y", (stop) => (stop.type === "start" ? 2 : 0))
      .text((stop) => stop.no);

    drawSelection();
  }

  function drawSelection() {
    svg.selectAll(".selection-layer").remove();
    if (!lastProjection || !selectedStop) return;
    const point = lastProjection([selectedStop.lon, selectedStop.lat]);
    const labelY = Math.max(22, point[1] - 24);

    const layer = svg.append("g").attr("class", "selection-layer");
    layer
      .append("circle")
      .attr("class", "selected-ring")
      .attr("cx", point[0])
      .attr("cy", point[1])
      .attr("r", 19);
    layer
      .append("text")
      .attr("class", "selected-label")
      .attr("x", point[0])
      .attr("y", labelY)
      .attr("text-anchor", "middle")
      .text(selectedStop.place);
  }

  function renderSelectedStop() {
    selectedPin.textContent = "핀 " + selectedStop.no + " · " + selectedStop.minute + "분";
    selectedPlace.textContent = selectedStop.place;
    selectedLocation.textContent =
      selectedStop.location + " · " + selectedStop.lat.toFixed(6) + ", " + selectedStop.lon.toFixed(6);
    selectedActivity.textContent = selectedStop.activity;

    for (const row of tableBody.querySelectorAll("tr")) {
      row.classList.toggle("is-selected", Number(row.dataset.stop) === selectedStop.no);
    }
    drawSelection();
  }

  function renderTable() {
    tableBody.replaceChildren();
    for (const stop of activeRoute.stops) {
      const row = document.createElement("tr");
      row.dataset.stop = String(stop.no);

      const pinCell = document.createElement("td");
      pinCell.className = "text-center";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-ghost stop-button";
      button.textContent = String(stop.no);
      button.setAttribute("aria-label", stop.no + "번 핀 " + stop.place + " 선택");
      button.addEventListener("click", () => selectStop(stop));
      pinCell.append(button);

      const minuteCell = document.createElement("td");
      minuteCell.className = "text-nowrap";
      minuteCell.textContent = stop.minute + "분";

      const placeCell = document.createElement("td");
      placeCell.textContent = stop.place;

      const activityCell = document.createElement("td");
      activityCell.textContent = stop.activity;

      row.append(pinCell, minuteCell, placeCell, activityCell);
      tableBody.append(row);
    }
  }

  function renderRoute() {
    routeName.textContent = activeRoute.name;
    routeMetrics.textContent =
      activeRoute.distance + " · " + activeRoute.duration + " · " + activeRoute.group + " · " + activeRoute.format;
    routeStatus.textContent = activeRoute.status;
    routeWarning.textContent = "운영 주의: " + activeRoute.warning;
    renderTable();
    renderMap();
    renderSelectedStop();
  }

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        renderMap();
        resizeFrame = null;
      });
    });
    observer.observe(root.querySelector(".map-wrap"));
  } else {
    window.addEventListener("resize", renderMap, { passive: true });
  }

  renderRoute();
})();
