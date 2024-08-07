(function() {
//console.log("wikipeadia.js is loading");
  const CONFIG = {
  CATEGORIES: [
    "המכלול: ערכים שנוצרו במכלול",
    "המכלול: ערכים שתורגמו במכלול",
    "המכלול: פירושונים שנוצרו במכלול"
  ],
  API_ENDPOINTS: {
    WIKIPEDIA: "https://he.wikipedia.org/w/api.php",
    LOCAL: "/w/api.php"
  },
  PAGE_IDS: {
    ADMIN_REQUESTS: "18228"
  },
  MESSAGES: {
    DELETE_CONFIRM: "האם למחוק את {0} ?",
    MOVE_REQUEST: "האם לבקש ממפעילים להעביר את הדף?"
  }
};
  const wikipediaApiEnedpoint = getApiUrl();
  const deleteRights = mw.config.get("wgUserGroups").includes("sysop") || mw.config.get("wgUserGroups").includes("technicalbot");
  const textDeleteButton =  deleteRights? "מחיקת הדף" : "בקש מחיקה" ;
  const isMobileView = document.getElementsByClassName("minerva-header").length > 0;
  const wgCategories = mw.config.get("wgCategories") || [];
  const shouldRun = !CONFIG.CATEGORIES.some(cat => wgCategories.includes(cat)) &&
    mw.config.get("wgNamespaceNumber") === 0 &&
    mw.config.get("wgPageName") !== "עמוד_ראשי" &&
    mw.config.get("wgAction") === "view" &&
    !location.href.includes("&diff");

  if (shouldRun) {
    mw.loader.using(["mediawiki.api", "oojs-ui-core", "oojs-ui-widgets"]).then(initScript);
  }

  function initScript() {
    const PageName = window.PageName || cleanPageName(mw.config.get("wgPageName"));
    addStyles();
    setTimeout(() => getPageInfo(PageName), 1000);
  }
  function getApiUrl() {
    if (mw.config.get('wgUseNetfreeFiltering')) {
        return 'https://import.hamichlol.org.il/';
    } else {
        return 'https://he.wikipedia.org/w/api.php';
    }
}
  function cleanPageName(name) {
    return name.replace(/^(רבי_|הרב_)/, "")
      .replace(/_/g, " ")
      .replace(/ה"קדוש(ה|ים)?"/g, "הקדוש$1")
      .replace(/אישיות_מהתנ"ך/g, "דמות מקראית")
      .replace(/א-ל/g, "אל");
  }

function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .mobile-friendly-button { 
        margin: 5px; 
        font-size: 14px; 
        padding: 5px; 
      }
      .mobile-friendly-button-group { 
        margin-bottom: 2px; 
      }
      .status-box { 
        border: 1px solid #a2a9b1; 
        background-color: #f8f9fa; 
        padding: 2px; 
        margin-bottom: 5px; 
        border-radius: 2px; 
        text-align: center; 
        box-sizing: border-box; 
        height: auto; 
        
      }
      .status-message { 
        margin-top: 3px; 
      }
    `;
     document.head.appendChild(style);
}



  const createButton = (label, onClick, buttonClass) => {
    const button = new OO.ui.ButtonWidget({ label, flags: ['progressive'], classes: ['mobile-friendly-button', buttonClass] });
    button.on('click', onClick);
    return button.$element;
  };

  const createStatusBox = (message, buttons = []) => {
    const statusBox = $('<div class="status-box"></div>');
    statusBox.append(`<span class="status-message">${message}</span>`);
    if (buttons.length) {
      const buttonGroup = $('<div class="mobile-friendly-button-group"></div>').append(buttons);
      statusBox.append(buttonGroup);
    }
    return statusBox;
  };

  async function getPageInfo(pageName, steps = 0) {
    if (steps > 10) return;
    const apiParams = {
      action: "query", format: "json", list: "logevents",
      leprop: "ids|title|type|user|timestamp|comment|details", letype: "move",
      letitle: decodeURIComponent(pageName), lelimit: 1,
      prop: "info|revisions|langlinks|pageprops", titles: decodeURIComponent(pageName),
      indexpageids: true, redirects: 1, rvlimit: 1, rvprop: "size|ids",
      llprop: "langname|url", utf8: 1, lllang: "en", ppprop: "disambiguation", origin: "*"
    };

    try {
      const result = await $.ajax({ url: wikipediaApiEnedpoint, data: apiParams, dataType: "json" });
      handleApiResponse(result, pageName);
    } catch (error) {
      handleApiError(error, pageName, steps);
    }
  }

  function handleApiResponse(result, pageName) {
    if (!result?.query) return;
    const pageId = result.query.pageids[0];
    pageId === "-1" ? handleNonExistentPage(result, pageName) : handleExistingPage(result, pageId, pageName);
  }

  function handleNonExistentPage(result, pageName) {
    result.query.logevents[0] ? handleMovedPage(result.query.logevents[0]) : checkForDeletedPage(pageName);
  }

  async function handleMovedPage(move) {
    const to = move.params.target_title;
    const spaceName = to.includes(":") ? `הערך הועבר בוויקיפדיה למרחב ${to.split(":")[0]}` : null;
    const { pageLink, hasNewClass } = await renderPageLink(to);
    
    if(spaceName) { 
      $("#bodyContent").prepend(createStatusBox(spaceName,
      [createButton(textDeleteButton, () => wikiAction("Delete", { reason:spaceName}), 'delete-request-button')])
    );
    } else {
        const buttons = [
      !hasNewClass ? createButton("עדכן הפניה", () => wikiAction("update", { to: redirectTarget }), 'update-redirect-button') : null,
      createButton("העבר דף", () => wikiAction("move", { to: redirectTarget }), 'move-page-button')
    ].filter(Boolean);
    $("#bodyContent").prepend(createStatusBox('הפניה אל: ' + pageLink, buttons));
    }
}
  async function checkForDeletedPage(pageName) {
    const deleteParams = {
      action: "query", format: "json", list: "logevents",
      leprop: "ids|title|type|user|timestamp|comment|details",
      letype: "delete", letitle: decodeURIComponent(pageName), lelimit: 1, origin: "*"
    };

    try {
      const result = await $.ajax({ url: wikipediaApiEnedpoint, data: deleteParams, dataType: "json" });
      result.query?.logevents[0] ? handleDeletedPage(result.query.logevents[0]) : handleNonExistentNonDeletedPage();
    } catch (error) {
      console.error("Error checking for deleted page:", error);
    }
  }

  async function handleDeletedPage(deleteEvent) {
    const comment = await renderWikiText(deleteEvent.comment);
    $("#bodyContent").prepend(createStatusBox('הדף נמחק בוויקיפדיה. סיבת המחיקה היא: ' + comment,
    [createButton(textDeleteButton , () => wikiAction("Delete", { reason: "הערך נמחק בוויקיפדיה העברית"}), 'delete-request-button')])
  );
  }

  function handleNonExistentNonDeletedPage() {
    $("#bodyContent").prepend(createStatusBox('לא נמצא דף בשם זה.', [
      createButton("נסה שוב", () => {
        $(".status-box").remove();
        getPageInfo(mw.config.get("wgPageName"));
      }, 'retry-button')
    ]));
  }

  function handleExistingPage(result, pageId, pageName) {
    const page = result.query.pages[pageId];
    result.query.redirects ? handleRedirectPage(result) :
    page.pageprops ? handleDisambiguationPage() :
    handleNormalPage(page, pageName);
  }

  async function handleRedirectPage(result) {
    const redirectTarget = result.query.redirects[0].to;
    const { pageLink, hasNewClass } = await renderPageLink(redirectTarget);
    const buttons = [
      !hasNewClass ? createButton("עדכן הפניה", () => wikiAction("update", { to: redirectTarget }), 'update-redirect-button') : null,
      createButton("העבר דף", () => wikiAction("move", { to: redirectTarget }), 'move-page-button')
    ].filter(Boolean);
    $("#bodyContent").prepend(createStatusBox('הפניה אל: ' + pageLink, buttons));
  }

  function handleDisambiguationPage() {
    $("#bodyContent").prepend(createStatusBox('ויקיפדיה: דף פירושונים.'));
  }

  function handleNormalPage(page, pageName) {
    const wikisize = page.revisions[0].size;
    handleLanguageLinks(page.langlinks);
    comparePageSizes(wikisize, pageName);
  }

  function handleLanguageLinks(langLinks) {
    if (langLinks?.[0]) {
      const { url } = langLinks[0];
      $("#p-lang").append(`
        <div class="vector-menu-content">
          <ul class="vector-menu-content-list">
            <li class="interlanguage-link interwiki-en">
              <a href="${url}" title="אנגלית" lang="en" hreflang="en" class="interlanguage-link-target" target="_blank">אנגלית</a>
            </li>
          </ul>
        </div>
      `);
    }
  }

  async function comparePageSizes(wikisize, pageName) {
    const localPageName = mw.config.get("wgPageName");
    const mparams = {
      action: "query", format: "json", prop: "info|revisions",
      titles: decodeURIComponent(localPageName), indexpageids: true,
      rvlimit: 1, rvprop: "size|ids"
    };

    try {
      const result = await $.ajax({ url: CONFIG.API_ENDPOINTS.LOCAL, data: mparams, dataType: "json" });
      if (result?.query) {
        const michsize = result.query.pages[result.query.pageids[0]].revisions[0].size;
        displaySizeDifference(wikisize, michsize, pageName);
      }
    } catch (error) {
      console.error("Error comparing page sizes:", error);
    }
  }

  function displaySizeDifference(wikisize, michsize, pageName) {
    const diffsize = wikisize - michsize;
    const el = Math.abs(diffsize) > 399 ? "strong" : "span";
    const sign = diffsize > 0 ? "+" : diffsize < 0 ? "-" : "";
    const className = diffsize > 0 ? "neg" : diffsize < 0 ? "pos" : "null";
    let item = `<div><div class="mw-rtrc-meta">ויקיפדיה:<${el} class="mw-plusminus mw-plusminus-${className}">(${sign}${Math.abs(diffsize).toLocaleString()})</${el}></div>`;
    
    const corname = mw.config.get("wgPageName").trim().replace(/_/g, " ");
    if (corname !== pageName.trim().replace(/_/g, " ")) item += ` (${pageName})`;
    item += "</div>";

    isMobileView ? $(".tagline").append(item) : $(".mw-indicators").append($("<div>", { class: "mw-indicator", html: item }));
  }

  function wikiAction(action, params = {}) {
    const page = mw.config.get("wgPageName").replace(/_/g, " ");
    const api = new mw.Api();

    const actions = {
      update: () => {
        const textpage = "#הפניה[[" + params.to + "]]";
        OO.ui.confirm("התוכן החדש יהיה: " + textpage).then(confirmed => {
          if (confirmed) {
            editPage(page, textpage);
          }
        });
      },
      move: () => {
        api.postWithToken("move", {
          action: "move",
          from: page,
          to: decodeURIComponent(params.to),
          reason: params.reason || "השוואה לוויקיפדיה העברית",
          movetalk: 1,
          movesubpages: 1 
        }).done(data => {
          if (data && data.move) {
            mw.notify(`הדף: ${data.move.from}\nהועבר בהצלחה לשם: ${data.move.to}`);
            updatePageClassification(data.move.to);
          }
        }).catch(error => handleMoveError(error, page, params.to, params.reason));
      },
      Delete: () => {
        if (!deleteRights) {
          api.postWithToken("edit", {
            action: "edit",
            format: "json",
            pageid: 18228,
            section: 1,
            appendtext: `\n\n*{{בקשת מחיקה|${page}|${params.reason}}} ~~` + `~~`,
            summary: `/* בקשות מחיקה */ [[${page}]]`,
          }).done(data => {
            if (data && data.edit) {
              mw.notify("בקשתך נשמרה בדף הבקשות ממפעילים");
            }
          });
        } else {
         const href = `/w/index.php?title=${encodeURIComponent(page)}&action=delete&wpReason=${encodeURIComponent(params.reason)}`;
         window.open(href);
        }
      },
      changePageText: () => editPage(params.to, params.newText, { summary: "מיון ויקיפדיה", minor: 1, nocreate: 1 })
    };

    if (actions[action]) {
      actions[action]();
    } else {
      mw.notify("פעולה לא חוקית. אנא השתמש באחת מהפעולות המוגדרות.");
    }
  }

  function editPage(title, text, options = {}) {
    const api = new mw.Api();
    return api.postWithToken("csrf", {
      action: "edit",
      format: "json",
      title: title,
      text: text,
      bot: 1,
      ...options
    }).done(data => {
      if (data && data.edit && data.edit.result === "Success") {
        mw.notify(`עריכת הדף: ${decodeURIComponent(data.edit.title)} הסתיימה`);
        location.reload();
      } else {
        console.log(data);
      }
    }).catch(error => {
      mw.notify("אירעה שגיאה בעת העריכה: " + error);
    });
  }

function handleMoveError(error, oldname, to, reason) {
  if (error === "missingtitle") {
    mw.notify("הדף לא קיים", {type: 'error'});
  } else if (error === "articleexists" || error === "rediredctexists") {
    handleExistingTargetPage(oldname, to, reason);
  } else if (error === "selfmove") {
    updatePageClassification(to);
  } else {
    mw.notify(error, {type: 'error'});
  }
}

function handleExistingTargetPage(oldname, to, reason) {
  const api = new mw.Api();
  if (deleteRights) {
    OO.ui.confirm(`למחוק את ${to} ?`).done(confirmed => {
      if (confirmed) {
        api.postWithToken("delete", {
          action: "delete",
          format: "json",
          title: to,
          reason: `מחיקה כדי לאפשר העברה מהשם [[${oldname}]]`,
        }).done(data => {
          if (data) {
            mw.notify("הדף נמחק כעת. המתן להעברת הדף");
            wikiAction("move", { to, reason });
          }
        });
      }
    });
  } else {
    OO.ui.confirm("האם לבקש ממפעילים להעביר את הדף?").done(confirmed => {
      if (confirmed) {
        api.postWithToken("edit", {
          action: "edit",
          format: "json",
          pageid: "18228",
          section: "6",
          appendtext: `\n*{{העברה|${oldname}|${to}}}  ${reason} ~~` + `~~`,
          summary: `/* העברת דף */ [[${oldname}]] >> [[${to}]]`,
        }).done(data => {
          if (data && data.edit) {
            mw.notify("בקשתך נשמרה בדף הבקשות ממפעילים");
          }
        });
      }
    });
  }
}

function updatePageClassification(to) {
  fetch(`/w/api.php?action=parse&format=json&page=${encodeURIComponent(to)}&prop=wikitext&utf8=1`)
    .then(response => response.json())
    .then(response => {
      let data = response.parse.wikitext["*"];
      const Template = /(\{\{מיון ויקיפדיה\|דף=)(.*)(\|גרסה=)(\d*)/;
      let selectName = Template.exec(data);
      
      if (selectName != null && selectName[2] != null) {
        const newText = data.replace(selectName[0], selectName[0].replace(selectName[2], to));
        changePageText(to, newText);
      } else {
        console.log("לא נמצא תבנית מיון ויקיפדיה");
        location.reload();
      }
    });
}

function changePageText(to, newText) {
  $.post(
    mw.util.wikiScript("api"),
    {
      action: "edit",
      format: "json",
      title: to,
      text: newText,
      summary: "מיון ויקיפדיה",
      minor: 1,
      bot: 1,
      nocreate: 1,
      token: mw.user.tokens.get("csrfToken"),
      utf8: 1,
    },
    data => {
      if (data && data.edit && data.edit.result == "Success") {
        mw.notify(`עריכת הדף: ${decodeURIComponent(data.edit.title)} הסתיימה`);
        location.reload();
      } else {
        console.log(data);
      }
    }
  );
}

function handleApiError(error, pageName, steps) {
  console.log(error.status);
  if (error.status === 500 || error.status === 418 || error.status === 0) return;
  steps++;
  getPageInfo(pageName, steps);
  console.log(error);
}


  async function renderPageLink(pageName) {
    const linkToSend = `${CONFIG.API_ENDPOINTS.LOCAL}?action=parse&format=json&title=עמוד ראשי&text=${encodeURIComponent(`[[${pageName}]]`)}&utf8=1`;
    try {
      const response = await fetch(linkToSend);
      const result = await response.json();
      const renderedLink = result.parse.text["*"].split("<p>")[1].split("</p>")[0];
      const hasNewClass = renderedLink.includes('class="new"') || renderedLink.includes('class="mw-redirect"');
      return { pageLink: renderedLink, hasNewClass };
    } catch (error) {
      console.error("Error rendering page link:", error);
    }
  }

  async function renderWikiText(text) {
    const linkToSend = `${CONFIG.API_ENDPOINTS.LOCAL}?action=parse&format=json&title=עמוד ראשי&text=${encodeURIComponent(text)}&utf8=1`;
    try {
      const response = await fetch(linkToSend);
      const result = await response.json();
      return result.parse.text["*"];
    } catch (error) {
      console.error("Error rendering wiki text:", error);
      return text;
    }
  }

})();
