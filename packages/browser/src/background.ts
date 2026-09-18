chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error('TechTerm: サイドパネルを設定できませんでした。', error));
