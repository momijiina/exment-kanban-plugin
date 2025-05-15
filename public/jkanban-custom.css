/* 基本的なスタイル調整 */
#kanban {
  overflow-x: auto;
  padding: 20px;
  background-color: #f4f7f9; /* ボード全体の背景色を少し明るく */
}

/* ボードのスタイル */
#kanban .kanban-board {
  background-color: #e9edf0; /* ボードの背景色 */
  border-radius: 8px; /* ボードの角を丸く */
  margin-right: 20px; /* ボード間のマージン */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* ボードに軽い影 */
}

#kanban .kanban-board header {
  background-color: #d1d9e0; /* ボードヘッダーの背景色 */
  color: #333;
  padding: 10px 15px;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
}

#kanban .kanban-board header .kanban-title-board {
  font-weight: bold;
  font-size: 1.1em;
}

#kanban .kanban-board .kanban-drag {
  min-height: 300px;
  padding: 15px;
  background-color: transparent; /* ドラッグエリアの背景はボードに合わせる */
}

/* カードのスタイル */
#kanban .kanban-container .kanban-item {
  position: relative;
  padding: 15px;
  margin-bottom: 15px;
  background-color: #ffffff; /* カードの背景色を白に */
  border-radius: 6px; /* カードの角を丸く */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24); /* カードに影を付ける */
  transition: box-shadow 0.3s cubic-bezier(.25,.8,.25,1); /* ホバー時のアニメーション準備 */
}

#kanban .kanban-container .kanban-item:hover {
  box-shadow: 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23); /* ホバー時により濃い影 */
}

#kanban .kanban-container .kanban-item-text {
  display: inline-block;
  width: calc(100% - 45px); /* アイコンスペースを考慮 */
  word-wrap: break-word;
  font-size: 0.9em;
  line-height: 1.4;
  color: #333;
}

/* カード内アイコンのスタイル */
.kanban-container .kanban-item-icon {
  position: absolute;
  right: 10px; /* 右端からの位置調整 */
  top: 50%;
  transform: translateY(-50%);
  -webkit-transform: translateY(-50%);
  display: flex;
  flex-direction: column; /* アイコンを縦に並べる場合 */
}

.kanban-container .kanban-item-icon i {
  padding: 4px;
  color: #757575; /* アイコンの色を少し薄く */
  transition: color 0.2s ease-in-out;
}

.kanban-container .kanban-item-icon i:hover {
  color: #333; /* ホバー時にアイコンの色を濃く */
}

.kanban-container .kanban-item-icon i.fa-eye,
.kanban-container .kanban-item-icon i.fa-external-link,
.kanban-container .kanban-item-icon i.fa-edit, /* 編集アイコン用 (仮) */
.kanban-container .kanban-item-icon i.fa-trash /* 削除アイコン用 (仮) */
{
  cursor: pointer;
}

.kanban-container .kanban-item-icon i.fa-arrows-alt, /* jKanban標準の移動アイコンに合わせる */
.kanban-container .kanban-item-icon i.fa-arrows /* 古いバージョン用 */
{
  cursor: move;
}

/* 優先度/ステータス用カラーバー (左端) */
.kanban-item .priority-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  border-top-left-radius: 6px;
  border-bottom-left-radius: 6px;
}

/* 担当者アバター (仮スタイル) */
.kanban-item .assignee-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin-right: 8px;
  background-color: #ccc; /* デフォルト背景 */
  display: inline-block;
  vertical-align: middle;
  /* TODO: 画像を背景として設定 */
}

/* 期日表示 (仮スタイル) */
.kanban-item .due-date {
  font-size: 0.8em;
  color: #757575;
  margin-top: 8px;
  display: block;
}

.kanban-item .due-date.overdue {
  color: #d32f2f; /* 赤色 */
  font-weight: bold;
}

.kanban-item .due-date.near-due {
  color: #f57c00; /* オレンジ色 */
}

/* 添付ファイルアイコン (仮スタイル) */
.kanban-item .attachment-icon {
  font-size: 0.8em;
  color: #757575;
  margin-top: 5px;
}

/* カスタムフィールド表示エリア (仮スタイル) */
.kanban-item .custom-fields {
  margin-top: 10px;
  font-size: 0.8em;
  color: #555;
}

.kanban-item .custom-fields .field {
  margin-bottom: 3px;
}

/* ドラッグ中のスタイル */
.gu-mirror { /* dragula.jsのミラー要素 */
  opacity: 0.8;
  transform: rotate(3deg);
  box-shadow: 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23);
}

/* ドロップ可能エリアのハイライト (仮) */
.gu-transit {
  background-color: rgba(0, 0, 0, 0.05);
}
