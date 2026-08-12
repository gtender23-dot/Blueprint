var _orders = {};
function getOrder(tableId, cols) {
  const stored = _orders[tableId];
  if (!stored) return cols;
  const byId = Object.fromEntries(cols.map((c) => [c.id, c]));
  const ordered = stored.map((id) => byId[id]).filter(Boolean);
  const knownIds = new Set(stored);
  cols.forEach((c) => {
    if (!knownIds.has(c.id)) ordered.push(c);
  });
  return ordered;
}
function moveCol(tableId, cols, fromId, toId) {
  const ids = getOrder(tableId, cols).map((c) => c.id);
  const fi = ids.indexOf(fromId);
  const ti = ids.indexOf(toId);
  if (fi === -1 || ti === -1 || fi === ti) return;
  ids.splice(fi, 1);
  ids.splice(ti, 0, fromId);
  _orders[tableId] = ids;
}
function setupDrag(tableId, cols, rerenderFn) {
  let dragId = null;
  const ths = document.querySelectorAll(`th[data-tbl="${tableId}"]`);
  ths.forEach((th) => {
    th.addEventListener("dragstart", (e) => {
      dragId = th.dataset.col;
      e.dataTransfer.effectAllowed = "move";
      requestAnimationFrame(() => th.classList.add("col-dragging"));
    });
    th.addEventListener("dragend", () => {
      dragId = null;
      th.classList.remove("col-dragging");
      ths.forEach((t) => t.classList.remove("col-drag-over"));
    });
    th.addEventListener("dragover", (e) => {
      if (!dragId || dragId === th.dataset.col) return;
      e.preventDefault();
      ths.forEach((t) => t.classList.remove("col-drag-over"));
      th.classList.add("col-drag-over");
    });
    th.addEventListener("dragleave", () => th.classList.remove("col-drag-over"));
    th.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragId || dragId === th.dataset.col) return;
      moveCol(tableId, cols, dragId, th.dataset.col);
      rerenderFn();
    });
  });
}

export { getOrder, setupDrag };
