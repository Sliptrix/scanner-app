/**
 * QR Inventory Editor
 * Minimal scan/edit page for Active_Inventory via Microsoft Graph.
 *
 * Usage (from a dedicated inventory.html):
 *   QRInventoryEditor.init({
 *     mountId: 'app',
 *     tableName: 'tblActiveInventory',
 *     idColumn: 'Container_ID',
 *     editableColumns: ['Stage', 'Location', 'Notes', 'Quantity', 'Media_Batch_ID']
 *   });
 */

(function () {
  'use strict';

  // Expose on window
  const QRInventoryEditor = {
    async init(options) {
      const {
        mountId = 'app',
        tableName = 'tblActiveInventory',
        idColumn = 'Container_ID',
        editableColumns = ['Stage', 'Location', 'Notes', 'Quantity', 'Media_Batch_ID']
      } = options || {};

      const mount = document.getElementById(mountId);
      if (!mount) {
        console.error(`QRInventoryEditor: mount element #${mountId} not found`);
        return;
      }

      const cid = parseCid();
      if (!cid) {
        renderError(mount, 'Missing "cid" in URL. Example: /inventory.html?cid=2317');
        return;
      }

      try {
        const tokenState = await ensureSignedInAndToken();
        if (!tokenState) return;

        if (!tokenState.signedIn) {
          renderSignIn(mount, async () => {
            if (window.AuthManager && typeof window.AuthManager.signIn === 'function') {
              window.AuthManager.signIn(); // loginRedirect; page will navigate
            }
          });
          return;
        }

        const token = tokenState.token;

        const cached = cacheGet(cid);
        if (cached) {
          renderForm({
            mount,
            cid,
            item: cached.item,
            editableColumns,
            onReload: () => window.location.reload(),
            onSave: async (patch) => {
              await savePatch({
                mount,
                cid,
                token,
                tableName,
                idColumn,
                editableColumns,
                patch
              });
            }
          });
          return;
        }

        renderLoading(mount, cid);

        const { driveId, itemId } = await getWorkbookIdentity();
        const { columns, columnsMap, rows } = await getTableRows({
          token,
          driveId,
          itemId,
          tableName
        });

        const found = findRowByCid({ cid, columnsMap, rows, idColumn });
        if (!found) {
          renderError(mount, `No record found where ${idColumn} = ${cid}`);
          return;
        }

        const item = rowToItem(columns, found.rowValues);
        cacheSet(cid, { item, rowIndex: found.rowIndex, columns, columnsMap });

        renderForm({
          mount,
          cid,
          item,
          editableColumns,
          onReload: () => window.location.reload(),
          onSave: async (patch) => {
            await savePatch({
              mount,
              cid,
              token,
              tableName,
              idColumn,
              editableColumns,
              patch
            });
          }
        });
      } catch (e) {
        console.error('QRInventoryEditor init error', e);
        renderError(mount, e.message || String(e));
      }
    }
  };

  // ---- Tiny cache for repeated scans (per page load)
  const cache = new Map(); // cid -> { item, rowIndex, columns, columnsMap, ts }
  const CACHE_TTL_MS = 15000;

  function cacheGet(cid) {
    const c = cache.get(cid);
    if (!c) return null;
    if (Date.now() - c.ts > CACHE_TTL_MS) {
      cache.delete(cid);
      return null;
    }
    return c;
  }

  function cacheSet(cid, payload) {
    cache.set(cid, Object.assign({}, payload, { ts: Date.now() }));
  }

  function parseCid() {
    try {
      const sp = new URLSearchParams(window.location.search);
      const cid = (sp.get('cid') || '').trim();
      return cid || null;
    } catch (e) {
      console.error('QRInventoryEditor: failed to parse cid from URL', e);
      return null;
    }
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function renderLoading(mount, cid) {
    mount.innerHTML = '';
    mount.appendChild(
      el(
        '<div>' +
          '<div class="muted">Loading record for</div>' +
          '<div class="mono" style="font-size:18px; margin-top:4px;">cid=' +
          escapeHtml(cid) +
          '</div>' +
          '<div class="muted" style="margin-top:10px;">Fetching from Excel8via Microsoft Graph96hellip;</div>' +
          '</div>'
      )
    );
  }

  function renderError(mount, msg) {
    mount.innerHTML = '';
    mount.appendChild(el('<div class="error">' + escapeHtml(msg) + '</div>'));
  }

  function renderSignIn(mount, onSignIn) {
    mount.innerHTML = '';
    mount.appendChild(
      el(
        '<div>' +
          '<div style="font-size:18px; font-weight:600;">Sign in required</div>' +
          '<div class="muted" style="margin-top:6px;">Use your Microsoft 365 account to view/edit inventory.</div>' +
          '<div class="actions">' +
          '<button id="btnSignIn">Sign in with Microsoft</button>' +
          '</div>' +
          '</div>'
      )
    );
    const btn = mount.querySelector('#btnSignIn');
    if (btn) {
      btn.addEventListener('click', onSignIn);
    }
  }

  function renderForm(opts) {
    const {
      mount,
      cid,
      item,
      editableColumns,
      onSave,
      onReload,
      statusMsg
    } = opts;

    const fieldsHtml = editableColumns
      .map(function (col) {
        const v = item && Object.prototype.hasOwnProperty.call(item, col) ? item[col] : '';
        if (col.toLowerCase().indexOf('notes') !== -1) {
          return (
            '<div class="row">' +
            '<label>' + escapeHtml(col) + '</label>' +
            '<textarea id="f_' + escapeHtmlAttr(col) + '" rows="4">' +
            escapeHtml(v == null ? '' : String(v)) +
            '</textarea>' +
            '</div>'
          );
        }
        return (
          '<div class="row">' +
          '<label>' + escapeHtml(col) + '</label>' +
          '<input id="f_' + escapeHtmlAttr(col) + '" value="' +
          escapeHtmlAttr(v == null ? '' : String(v)) +
          '" />' +
          '</div>'
        );
      })
      .join('');

    mount.innerHTML = '';
    mount.appendChild(
      el(
        '<div>' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-end; gap:12px;">' +
          '<div>' +
          '<div class="muted">Inventory record</div>' +
          '<div class="mono" style="font-size:18px; margin-top:4px;">cid=' +
          escapeHtml(cid) +
          '</div>' +
          '</div>' +
          '<button id="btnReload" style="width:auto;">Reload</button>' +
          '</div>' +
          '<hr style="border:none; border-top:1px solid #eee; margin:14px 0;" />' +
          '<div class="row">' +
          '<label>Strain_Name</label>' +
          '<div>' + escapeHtml(item && item.Strain_Name ? item.Strain_Name : '') + '</div>' +
          '</div>' +
          fieldsHtml +
          '<div class="actions">' +
          '<button id="btnSave">Save changes</button>' +
          '</div>' +
          (statusMsg
            ? '<div class="' +
              escapeHtmlAttr(statusMsg.kind || '') +
              '" style="margin-top:8px;">' +
              escapeHtml(statusMsg.text || '') +
              '</div>'
            : '') +
          '</div>'
      )
    );

    const reloadBtn = mount.querySelector('#btnReload');
    if (reloadBtn) reloadBtn.addEventListener('click', onReload);

    const saveBtn = mount.querySelector('#btnSave');
    if (saveBtn) {
      saveBtn.addEventListener('click', async function () {
        const patch = {};
        editableColumns.forEach(function (col) {
          const node = mount.querySelector('#f_' + cssSafeId(col));
          if (!node) return;
          patch[col] = node.value != null ? node.value : '';
        });
        await onSave(patch);
      });
    }
  }

  function cssSafeId(s) {
    return escapeHtmlAttr(s);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeHtmlAttr(s) {
    return escapeHtml(String(s)).replace(/\s+/g, '_');
  }

  function normalize(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, '_');
  }

  async function ensureSignedInAndToken() {
    if (!window.AuthManager) {
      renderConsoleWarn('AuthManager not found on window.');
      throw new Error('Authentication module not loaded.');
    }

    try {
      const signedIn = typeof window.AuthManager.isSignedIn === 'function'
        ? window.AuthManager.isSignedIn()
        : false;

      if (!signedIn) {
        return { signedIn: false, token: null };
      }

      if (typeof window.AuthManager.getAccessToken !== 'function') {
        throw new Error('AuthManager.getAccessToken is not available');
      }

      const token = await window.AuthManager.getAccessToken();
      if (!token) {
        throw new Error('Failed to acquire Microsoft Graph access token');
      }

      return { signedIn: true, token: token };
    } catch (e) {
      console.error('QRInventoryEditor: ensureSignedInAndToken failed', e);
      throw e;
    }
  }

  async function getWorkbookIdentity() {
    if (!window.OneDriveSync) {
      throw new Error('OneDriveSync module not loaded');
    }

    if (typeof window.OneDriveSync.getWorkbookIdentity === 'function') {
      return window.OneDriveSync.getWorkbookIdentity();
    }

    // Fallback: use existing properties + resolver
    if (!window.OneDriveSync.shareUrl) {
      throw new Error('OneDriveSync: No shareUrl configured');
    }

    if (!window.OneDriveSync.driveId || !window.OneDriveSync.itemId) {
      if (typeof window.OneDriveSync.resolveDriveItemFromShareUrl === 'function') {
        await window.OneDriveSync.resolveDriveItemFromShareUrl(window.OneDriveSync.shareUrl);
      }
    }

    if (!window.OneDriveSync.driveId || !window.OneDriveSync.itemId) {
      throw new Error('OneDriveSync: Failed to resolve driveId/itemId');
    }

    return {
      driveId: window.OneDriveSync.driveId,
      itemId: window.OneDriveSync.itemId
    };
  }

  async function graphFetch(token, url, init) {
    const headers = new Headers((init && init.headers) || {});
    headers.set('Authorization', 'Bearer ' + token);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const opts = Object.assign({}, init || {}, { headers: headers });
    const res = await fetch(url, opts);
    if (!res.ok) {
      let body = '';
      try {
        body = await res.text();
      } catch (e) {
        // ignore
      }
      throw new Error('Graph ' + res.status + ': ' + (body || res.statusText));
    }
    return res;
  }

  async function getTableRows(params) {
    const { token, driveId, itemId, tableName } = params;
    const base =
      'https://graph.microsoft.com/v1.0/drives/' +
      encodeURIComponent(driveId) +
      '/items/' +
      encodeURIComponent(itemId) +
      '/workbook';

    const columnsUrl =
      base +
      "/tables('" +
      tableName +
      "')/columns?$top=200";
    const rowsUrl =
      base +
      "/tables('" +
      tableName +
      "')/rows?$top=1000";

    const [colsRes, rowsRes] = await Promise.all([
      graphFetch(token, columnsUrl, {}),
      graphFetch(token, rowsUrl, {})
    ]);

    const colsJson = await colsRes.json();
    const rowsJson = await rowsRes.json();

    const columns = (colsJson.value || []).map(function (c) {
      return c.name;
    });
    const columnsMap = new Map();
    columns.forEach(function (name, idx) {
      columnsMap.set(normalize(name), idx);
    });

    const rows = rowsJson.value || [];
    return { columns: columns, columnsMap: columnsMap, rows: rows };
  }

  function rowToItem(columns, rowValues) {
    const item = {};
    for (var i = 0; i < columns.length; i++) {
      item[columns[i]] = rowValues[i];
    }
    return item;
  }

  function valuesMatchCid(cell, cid) {
    if (cell === null || cell === undefined) return false;
    const s = String(cell).trim();
    const c = String(cid).trim();
    if (!s || !c) return false;

    // Exact string match
    if (s === c) return true;

    // Numeric equivalence (e.g., 120022 vs "120022")
    const sn = parseInt(s, 10);
    const cn = parseInt(c, 10);
    if (!isNaN(sn) && !isNaN(cn) && sn === cn) return true;

    // Handle prefixed IDs like "LWG120022" where QR encodes just "120022"
    if (s.length > c.length && s.endsWith(c)) return true;

    return false;
  }

  function findRowByCid(params) {
    const { cid, columnsMap, rows, idColumn } = params;
    const idIdx = columnsMap.get(normalize(idColumn));
    if (idIdx == null) {
      throw new Error('Could not find id column "' + idColumn + '" in table columns.');
    }

    for (var r = 0; r < rows.length; r++) {
      var rowObj = rows[r];
      var values2d = rowObj && rowObj.values;
      var values = Array.isArray(values2d) ? values2d[0] : null;
      if (!values) continue;

      var cell = values[idIdx];
      if (valuesMatchCid(cell, cid)) {
        var rowIndex =
          typeof rowObj.index === 'number' && !isNaN(rowObj.index)
            ? rowObj.index
            : r;
        return {
          rowIndex: rowIndex,
          rowObject: rowObj,
          rowValues: values
        };
      }
    }
    return null;
  }

  async function updateRowValues(params) {
    const { token, driveId, itemId, tableName, rowIndex, newValues2d } = params;

    const base =
      'https://graph.microsoft.com/v1.0/drives/' +
      encodeURIComponent(driveId) +
      '/items/' +
      encodeURIComponent(itemId) +
      '/workbook';

    const url =
      base +
      "/tables('" +
      tableName +
      "')/rows/itemAt(index=" +
      rowIndex +
      ')';

    await graphFetch(token, url, {
      method: 'PATCH',
      body: JSON.stringify({ values: newValues2d })
    });
  }

  function buildUpdatedRowValues(params) {
    const { columns, columnsMap, oldRowValues, patch } = params;
    const next = oldRowValues.slice();

    Object.keys(patch || {}).forEach(function (k) {
      const idx = columnsMap.get(normalize(k));
      if (idx == null) return;
      if (normalize(k) === 'quantity') {
        const n = Number(patch[k]);
        next[idx] = isFinite(n) ? n : patch[k];
      } else {
        next[idx] = patch[k];
      }
    });

    return [next];
  }

  async function savePatch(opts) {
    const {
      mount,
      cid,
      token,
      tableName,
      idColumn,
      editableColumns,
      patch
    } = opts;

    const cached = cacheGet(cid);
    if (!cached) {
      renderError(mount, 'Cache expired; reload the page and try again.');
      return;
    }

    try {
      const { driveId, itemId } = await getWorkbookIdentity();

      // Re-fetch rows to stay in sync with any concurrent edits
      const { columns, columnsMap, rows } = await getTableRows({
        token,
        driveId,
        itemId,
        tableName
      });

      const found = findRowByCid({ cid, columnsMap, rows, idColumn });
      if (!found) {
        throw new Error('Record no longer found.');
      }

      const newValues2d = buildUpdatedRowValues({
        columns,
        columnsMap,
        oldRowValues: found.rowValues,
        patch
      });

      await updateRowValues({
        token,
        driveId,
        itemId,
        tableName,
        rowIndex: found.rowIndex,
        newValues2d
      });

      const updatedItem = rowToItem(columns, newValues2d[0]);
      cacheSet(cid, {
        item: updatedItem,
        rowIndex: found.rowIndex,
        columns: columns,
        columnsMap: columnsMap
      });

      renderForm({
        mount,
        cid,
        item: updatedItem,
        editableColumns,
        statusMsg: { kind: 'success', text: 'Saved.' },
        onReload: function () {
          window.location.reload();
        },
        onSave: async function (nextPatch) {
          await savePatch({
            mount,
            cid,
            token,
            tableName,
            idColumn,
            editableColumns,
            patch: nextPatch
          });
        }
      });
    } catch (e) {
      console.error('QRInventoryEditor savePatch error', e);
      renderForm({
        mount,
        cid,
        item: cached.item,
        editableColumns,
        statusMsg: { kind: 'error', text: e.message || String(e) },
        onReload: function () {
          window.location.reload();
        },
        onSave: async function (nextPatch) {
          await savePatch({
            mount,
            cid,
            token,
            tableName,
            idColumn,
            editableColumns,
            patch: nextPatch
          });
        }
      });
    }
  }

  function renderConsoleWarn(msg) {
    if (console && console.warn) console.warn(msg);
  }

  // Attach to window
  window.QRInventoryEditor = QRInventoryEditor;
})();
