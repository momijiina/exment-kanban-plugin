/**
 * Custom JavaScript for jKanban enhancements.
 */

let pluginOptions = {}; // To store options fetched from the backend
let kanbanInstance = null; // To store the jKanban instance

/**
 * Initializes jKanban with custom options and enhancements.
 */
function callJkanban() {
    try {
        pluginOptions = JSON.parse($("#kanban_plugin_options").val() || '{}');
    } catch (e) {
        console.error("Error parsing plugin options:", e);
        pluginOptions = {};
    }

    const boardData = JSON.parse($("#kanban_board_data").val() || '[]');

    // Prepare a basic string template for customHandler
    // It must include %s for the title, as jKanban will replace it.
    // We will add a placeholder for our enhanced content and populate it later.
    const basicItemTemplate = `
        <div class="kanban-item-content-wrapper">
            <div class="kanban-item-flex-container">
                <div class="kanban-item-avatar-container"></div>
                <div class="kanban-item-content">
                    <div class="kanban-item-header">
                        <span class="kanban-item-text">%s</span>
                    </div>
                    <div class="kanban-item-detail-text"></div> 
                    <div class="kanban-item-details-placeholder"></div> 
                    <div class="kanban-item-tags-container"></div>
                </div>
            </div>
        </div>
        <div class="kanban-item-icon">
            <div class="kanban-item-icon-row">
                <a href="javascript:void(0);" class="kanban-item-action view-item" title="詳細表示"><i class="fa fa-eye"></i></a>
                <i class="fa fa-arrows-alt item_handle kanban-drag-handle-icon" title="移動"></i>
            </div>
        </div>
    `;

    kanbanInstance = new jKanban({
        element: "#kanban",
        gutter: "20px",
        widthBoard: "300px",
        responsivePercentage: false,
        dragItems: true,
        boards: boardData, // Pass original board data, item details will be added post-render
        dragBoards: false,
        itemAddOptions: {
            enabled: false,
        },
        itemHandleOptions: {
            enabled: true,
            handleClass: "item_handle",
            customCssHandler: "kanban-item-content-wrapper", // This class is on the div returned by customHandler
            customCssIconHandler: "kanban-drag-handle-icon",
            customHandler: basicItemTemplate // Use the basic string template
        },
        click: function(el) {
            // General click on item, specific actions are bound later or via event delegation
        },
        dragEl: function(el, source) {
            $(el).addClass("is-dragging");
        },
        dragendEl: function(el) {
            $(el).removeClass("is-dragging");
        },
        dropEl: function(el, target, source, sibling) {
            const updateUrl = getUpdateUrl($(el));
            const boardId = $(target).closest(".kanban-board").data("id");
            const originalBoards = JSON.parse($("#kanban_board_data").val() || '[]');
            let targetBoardConfig = null;
            let updateColumnName = null;

            for (let i = 0; i < originalBoards.length; i++) {
                if (originalBoards[i].id === boardId) {
                    targetBoardConfig = originalBoards[i];
                    updateColumnName = originalBoards[i].column_name;
                    break;
                }
            }

            if (!updateColumnName || !targetBoardConfig) {
                toastr.error("移動先のボード情報が見つかりません。");
                return;
            }

            let valueToUpdate = {};
            valueToUpdate[updateColumnName] = targetBoardConfig.key;

            let data = {
                _token: LA.token,
                value: valueToUpdate,
            };
            mergeIdAndTable($(el), data);

            $.ajax({
                type: "POST",
                url: updateUrl,
                data: data,
                success: function(response) {
                    toastr.success("更新が完了しました！");
                    // After a successful drop, re-render enhanced content for the moved item
                    // and potentially items in source/target if their data changed.
                    // For simplicity, we can re-render all cards, or just the moved one.
                    renderEnhancedCardContentForItem($(el)); 
                },
                error: function(response) {
                    toastr.error("更新に失敗しました。");
                    console.error("Update failed: ", response);
                }
            });
        },
        dragBoard: function(el, source) {},
        dragendBoard: function(el) {},
        buttonClick: function(el, boardId) {},
        boardsLoaded: function() { // Custom callback, if jKanban supported it (it doesn't explicitly)
            // This is a conceptual place. We'll call it manually after init.
            renderAllEnhancedCardContents();
            appendKanbanItemEvent();
        }
    });

    // Manually call rendering enhancements after jKanban initializes and draws boards
    if (kanbanInstance) {
        renderAllEnhancedCardContents();
        appendKanbanItemEvent();
    }
}

/**
 * Iterates over all Kanban items and renders enhanced content.
 */
function renderAllEnhancedCardContents() {
    if (!kanbanInstance) return;
    $("#kanban .kanban-item").each(function() {
        renderEnhancedCardContentForItem($(this));
    });
}

/**
 * Renders enhanced HTML content for a single Kanban item.
 * @param {jQuery} $itemEl The jQuery element of the Kanban card.
 */
function renderEnhancedCardContentForItem($itemEl) {
    if (!kanbanInstance || !$itemEl || $itemEl.length === 0) return;

    const itemId = $itemEl.data("eid"); // jKanban stores original item id in data-eid
    if (!itemId) return;

    // Find the original item data from boardData using itemId
    const boardData = JSON.parse($("#kanban_board_data").val() || '[]');
    let itemData = null;
    for (const board of boardData) {
        const foundItem = board.item.find(i => `item-id-${i.dataid}` === itemId || i.id === itemId ); // Match by constructed ID or original if available
        if (foundItem) {
            itemData = foundItem;
            break;
        }
    }

    if (!itemData) {
        // console.warn("Original item data not found for item element:", $itemEl, "with data-eid:", itemId);
        return;
    }

    // Placeholder for details
    const $detailsPlaceholder = $itemEl.find(".kanban-item-details-placeholder");
    const $detailTextElement = $itemEl.find(".kanban-item-detail-text");
    const $tagsContainer = $itemEl.find(".kanban-item-tags-container");

    if ($detailTextElement.length > 0 && itemData.detail) {
        $detailTextElement.text(itemData.detail); // Display the detail text
    }

    if ($detailsPlaceholder.length === 0) return; // Should not happen if template is correct

    let detailsHtml = '';

    // アバター表示
    const $avatarContainer = $itemEl.find(".kanban-item-avatar-container");
    if ($avatarContainer.length > 0 && itemData.avatar_info) {
        const avatarInfo = itemData.avatar_info;
        let avatarHtml = '';
        
        // デバッグ情報をコンソールに出力
        console.log("Avatar info for item:", itemData.id, avatarInfo);
        
        // アバターURLの検証
        let validAvatarUrl = false;
        if (avatarInfo.avatar) {
            // 画像URLが存在するか確認
            const img = new Image();
            img.onload = function() {
                // 画像が正常に読み込めた場合
                console.log("Avatar image loaded successfully:", avatarInfo.avatar);
            };
            img.onerror = function() {
                // 画像が読み込めなかった場合、イニシャルに切り替え
                console.log("Avatar image failed to load:", avatarInfo.avatar);
                if (avatarInfo.name) {
                    const initial = avatarInfo.name.charAt(0).toUpperCase();
                    const colors = ['#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e', '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50', '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#f39c12', '#d35400', '#c0392b', '#bdc3c7'];
                    const colorIndex = Math.abs(avatarInfo.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
                    const bgColor = colors[colorIndex];
                    
                    $avatarContainer.html(`<div class="kanban-avatar-initial" style="background-color: ${bgColor};" title="${avatarInfo.name}">${initial}</div>`);
                }
            };
            
            // 画像URLをセット
            img.src = avatarInfo.avatar;
            validAvatarUrl = true;
            
            // 画像HTMLを生成
            avatarHtml = `<div class="kanban-avatar-image"><img src="${avatarInfo.avatar}" alt="${avatarInfo.name}" title="${avatarInfo.name}" onerror="this.style.display='none'; this.parentNode.innerHTML='<div class=\'kanban-avatar-initial\' style=\'background-color: ${getColorFromName(avatarInfo.name)};\' title=\'${avatarInfo.name}\'>${avatarInfo.name.charAt(0).toUpperCase()}</div>'"></div>`;
        }
        
        // 画像URLがない場合はイニシャルを表示
        if (!validAvatarUrl && avatarInfo.name) {
            // 名前からイニシャルを生成
            const initial = avatarInfo.name.charAt(0).toUpperCase();
            // ランダムな背景色を生成（名前に基づいて一貫性を持たせる）
            const colors = ['#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e', '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50', '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#f39c12', '#d35400', '#c0392b', '#bdc3c7'];
            const colorIndex = Math.abs(avatarInfo.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
            const bgColor = colors[colorIndex];
            
            avatarHtml = `<div class="kanban-avatar-initial" style="background-color: ${bgColor};" title="${avatarInfo.name}">${initial}</div>`;
        }
        
        if (avatarHtml) {
            $avatarContainer.html(avatarHtml);
        }
    }
    
    // 名前から色を生成するヘルパー関数（onerrorで使用）
    function getColorFromName(name) {
        if (!name) return '#bdc3c7';
        const colors = ['#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e', '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50', '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#f39c12', '#d35400', '#c0392b', '#bdc3c7'];
        const colorIndex = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
        return colors[colorIndex];
    }

    // Priority Bar
    if (pluginOptions.show_priority_bar && itemData.priority) {
        const priorityColors = {
            'high': pluginOptions.priority_color_high || '#ff4d4f',
            'medium': pluginOptions.priority_color_medium || '#ffa940',
            'low': pluginOptions.priority_color_low || '#52c41a',
            'default': '#bfbfbf'
        };
        const color = priorityColors[String(itemData.priority).toLowerCase()] || priorityColors['default'];
        detailsHtml += `<div class="priority-bar" style="background-color: ${color};"></div>`;
        // Note: The priority bar is added here but CSS positions it to the left of the card.
        // It might be better to prepend it to $itemEl directly if CSS is set up for that.
        // For now, let's ensure the CSS can handle it inside the placeholder or adjust CSS.
        // Let's try prepending to the item itself for better visual effect with current CSS.
        if ($itemEl.find('.priority-bar').length === 0) {
             $itemEl.prepend(`<div class="priority-bar" style="background-color: ${color};"></div>`);
        }
    }

    // Assignee
    if (pluginOptions.show_assignee && itemData.assignee && itemData.assignee.name) {
        const avatar = itemData.assignee.avatar ? `<img src="${itemData.assignee.avatar}" alt="${itemData.assignee.name}" class="assignee-avatar">` : `<span class="assignee-avatar-placeholder">${itemData.assignee.name.substring(0,1)}</span>`;
        detailsHtml += `<div class="assignee-info">${avatar}<span>${itemData.assignee.name}</span></div>`;
    }

    // Due Date
    if (pluginOptions.show_due_date && itemData.dueDate) {
        const dueDate = new Date(itemData.dueDate);
        const now = new Date();
        now.setHours(0,0,0,0); // Compare dates only
        let dueDateClass = 'due-date';
        if (dueDate < now) dueDateClass += ' overdue';
        // Add near-due logic if needed (e.g., within X days)
        detailsHtml += `<div class="${dueDateClass}">期日: ${itemData.dueDate}</div>`;
    }

    // Attachment Icon
    if (pluginOptions.show_attachment_icon && itemData.has_attachment) {
        detailsHtml += `<i class="fa fa-paperclip attachment-icon" title="添付ファイルあり"></i>`;
    }

    // Custom Fields
    if (pluginOptions.card_custom_fields && pluginOptions.card_custom_fields.length > 0 && itemData.customFieldsData) {
        detailsHtml += '<div class="custom-fields">';
        pluginOptions.card_custom_fields.forEach(fieldKey => {
            if (itemData.customFieldsData[fieldKey]) {
                // Ideally, get column_view_name for the fieldKey for a better label
                detailsHtml += `<div class="field"><strong>${fieldKey}:</strong> ${itemData.customFieldsData[fieldKey]}</div>`;
            }
        });
        detailsHtml += '</div>';
    }

    $detailsPlaceholder.html(detailsHtml);
    
    // タグ選択UIの表示
    if (itemData.tag_column && itemData.tag_options && Object.keys(itemData.tag_options).length > 0) {
        renderTagSelectionUI($tagsContainer, itemData);
    }
}

/**
 * タグ選択UIを描画する
 * @param {jQuery} $container タグUIを表示するコンテナ要素
 * @param {Object} itemData アイテムデータ
 */
function renderTagSelectionUI($container, itemData) {
    if (!$container || $container.length === 0 || !itemData) return;
    
    const tagColumnName = itemData.tag_column;
    const tagOptions = itemData.tag_options || {};
    
    // バグ修正: current_tagsの取得と検証を強化
    let currentTags = [];
    
    // デバッグ情報をコンソールに出力
    console.log("Item data for tag rendering:", itemData);
    
    if (Array.isArray(itemData.current_tags) && itemData.current_tags.length > 0) {
        currentTags = itemData.current_tags;
        console.log("Using current_tags array:", currentTags);
    } else if (itemData.raw_tag_value) {
        // raw_tag_valueからタグを抽出（バックアップ手段）
        console.log("Trying to extract from raw_tag_value:", itemData.raw_tag_value);
        
        const rawValue = itemData.raw_tag_value;
        if (Array.isArray(rawValue)) {
            if (rawValue.length > 0) {
                if (typeof rawValue[0] === 'object') {
                    // 配列の配列の場合
                    currentTags = rawValue.map(item => {
                        if (item.key) return item.key;
                        if (item.id) return item.id;
                        if (item.value) return item.value;
                        return item;
                    }).filter(Boolean);
                } else {
                    // 単純な値の配列
                    currentTags = rawValue.filter(Boolean);
                }
            }
        } else if (typeof rawValue === 'object') {
            // オブジェクトの場合
            if (rawValue.key) currentTags.push(rawValue.key);
            else if (rawValue.id) currentTags.push(rawValue.id);
            else if (rawValue.value) currentTags.push(rawValue.value);
        } else if (rawValue) {
            // スカラー値の場合
            currentTags.push(rawValue);
        }
        
        console.log("Extracted tags from raw_tag_value:", currentTags);
    }
    
    // 常に複数選択を有効にする
    const allowMultiple = true;
    const itemId = itemData.dataid;
    const tableName = itemData.table_name;
    const updateUrl = itemData.update_url;
    
    let tagsHtml = '';
    
    // タグ選択UIを横並びに変更
    tagsHtml += '<div class="kanban-item-tags-row">';
    
    // 「タグ」ラベルと選択タグを横並びに表示
    tagsHtml += '<span class="kanban-item-tags-label">タグ</span>';
    
    // タグ選択UIの本体
    tagsHtml += `<div class="kanban-item-tags-selection" data-item-id="${itemId}" data-table-name="${tableName}" data-column-name="${tagColumnName}">`;
    
    // 現在のカードに設定されているタグのみを表示
    if (currentTags && currentTags.length > 0) {
        console.log("Rendering tags:", currentTags);
        currentTags.forEach(tagKey => {
            if (tagOptions[tagKey]) {
                tagsHtml += `
                    <div class="tag-chip tag-selected" data-tag-value="${tagKey}" data-allow-multiple="${allowMultiple}">
                        ${tagOptions[tagKey]}
                    </div>
                `;
            } else {
                console.log("Tag key not found in options:", tagKey);
            }
        });
    } else {
        // タグが選択されていない場合は何も表示しない
        console.log("No tags to display");
        tagsHtml += '<div class="no-tags-message">タグなし</div>';
    }
    
    // タグ編集ボタンを表示
    tagsHtml += `
        <div class="tag-chip tag-edit-button" title="タグを編集">
            <i class="fa fa-pencil"></i>
        </div>
    `;
    
    tagsHtml += '</div>'; // kanban-item-tags-selection の終了
    tagsHtml += '</div>'; // kanban-item-tags-row の終了
    
    $container.html(tagsHtml);
    
    // タグ編集ボタンのイベントハンドラを設定
    $container.find('.tag-chip.tag-edit-button').off('click').on('click', function() {
        showTagSelectionPopup($container, itemData);
    });
}

/**
 * タグ選択ポップアップを表示する
 * @param {jQuery} $container タグUIを表示するコンテナ要素
 * @param {Object} itemData アイテムデータ
 */
function showTagSelectionPopup($container, itemData) {
    const tagOptions = itemData.tag_options || {};
    const currentTags = [];
    
    // 現在選択されているタグを取得
    $container.find('.tag-chip.tag-selected').each(function() {
        currentTags.push($(this).data('tag-value'));
    });
    
    // ポップアップを作成
    let popupHtml = `
        <div class="tag-selection-popup">
            <div class="tag-selection-popup-header">
                タグを選択
                <span class="tag-selection-popup-close">&times;</span>
            </div>
            <div class="tag-selection-popup-content">
    `;
    
    // 全タグオプションを表示
    Object.entries(tagOptions).forEach(([key, label]) => {
        const isChecked = currentTags.includes(key);
        const checkedClass = isChecked ? 'tag-selected' : '';
        popupHtml += `
            <div class="tag-chip ${checkedClass}" data-tag-value="${key}">
                ${label}
            </div>
        `;
    });
    
    popupHtml += `
            </div>
            <div class="tag-selection-popup-footer">
                <button class="tag-selection-popup-apply">適用</button>
                <button class="tag-selection-popup-cancel">キャンセル</button>
            </div>
        </div>
    `;
    
    // ポップアップをページに追加
    const $popup = $(popupHtml);
    $('body').append($popup);
    
    // ポップアップの位置を設定
    const containerOffset = $container.offset();
    $popup.css({
        top: containerOffset.top + $container.height() + 5,
        left: containerOffset.left
    });
    
    // タグクリックのイベントハンドラを設定
    $popup.find('.tag-chip').on('click', function() {
        $(this).toggleClass('tag-selected');
    });
    
    // 閉じるボタンのイベントハンドラを設定
    $popup.find('.tag-selection-popup-close, .tag-selection-popup-cancel').on('click', function() {
        $popup.remove();
    });
    
    // 適用ボタンのイベントハンドラを設定
    $popup.find('.tag-selection-popup-apply').on('click', function() {
        // 選択されたタグを取得
        const selectedTags = [];
        $popup.find('.tag-chip.tag-selected').each(function() {
            selectedTags.push($(this).data('tag-value'));
        });
        
        // タグ選択UIを更新
        updateTagSelectionUI($container, itemData, selectedTags);
        
        // ポップアップを閉じる
        $popup.remove();
    });
}

/**
 * タグ選択UIを更新する
 * @param {jQuery} $container タグUIを表示するコンテナ要素
 * @param {Object} itemData アイテムデータ
 * @param {Array} selectedTags 選択されたタグのキー配列
 */
function updateTagSelectionUI($container, itemData, selectedTags) {
    const tagOptions = itemData.tag_options || {};
    const tagColumnName = itemData.tag_column;
    const itemId = itemData.dataid;
    const tableName = itemData.table_name;
    
    // タグ選択UIの本体を取得
    const $tagSelection = $container.find('.kanban-item-tags-selection');
    
    // 既存のタグをクリア（編集ボタンは残す）
    $tagSelection.find('.tag-chip.tag-selected, .no-tags-message').remove();
    
    // 選択されたタグを追加
    let tagsHtml = '';
    if (selectedTags.length > 0) {
        selectedTags.forEach(tagKey => {
            if (tagOptions[tagKey]) {
                tagsHtml += `
                    <div class="tag-chip tag-selected" data-tag-value="${tagKey}" data-allow-multiple="true">
                        ${tagOptions[tagKey]}
                    </div>
                `;
            }
        });
    } else {
        // タグが選択されていない場合
        tagsHtml += '<div class="no-tags-message">タグなし</div>';
    }
    
    // 編集ボタンの前に挿入
    const $editButton = $tagSelection.find('.tag-edit-button');
    $editButton.before(tagsHtml);
    
    // タグ選択を保存
    saveTagSelection($container, selectedTags);
}

/**
 * タグ選択を保存する
 * @param {jQuery} $container タグUIを表示するコンテナ要素
 * @param {Array} selectedTags 選択されたタグのキー配列（省略時は現在の選択から取得）
 */
function saveTagSelection($container, selectedTags = null) {
    const $tagSelection = $container.find('.kanban-item-tags-selection');
    const itemId = $tagSelection.data('item-id');
    const tableName = $tagSelection.data('table-name');
    const columnName = $tagSelection.data('column-name');
    const updateUrl = getUpdateUrlFromItemId(itemId);
    
    if (!updateUrl) {
        console.error("Update URL not found for item:", itemId);
        return;
    }
    
    // 選択されたタグを取得
    if (selectedTags === null) {
        selectedTags = [];
        $tagSelection.find('.tag-chip.tag-selected').each(function() {
            selectedTags.push($(this).data('tag-value'));
        });
    }
    
    // 更新データの作成
    let valueToUpdate = {};
    valueToUpdate[columnName] = selectedTags;
    
    // サーバーに送信
    let data = {
        _token: LA.token,
        value: valueToUpdate,
        id: itemId,
        table_name: tableName
    };
    
    console.log("Saving tags:", selectedTags, "for item:", itemId);
    
    $.ajax({
        type: "POST",
        url: updateUrl,
        data: data,
        success: function(response) {
            // 静かに成功（通知なし）
            console.log("Tag update success:", response);
            
            // ボードデータを更新
            const boardData = JSON.parse($("#kanban_board_data").val() || '[]');
            for (const board of boardData) {
                for (const item of board.item) {
                    if (item.dataid === itemId) {
                        item.current_tags = selectedTags;
                        // raw_tag_valueも更新（次回表示時のために）
                        item.raw_tag_value = selectedTags;
                        break;
                    }
                }
            }
            $("#kanban_board_data").val(JSON.stringify(boardData));
        },
        error: function(response) {
            toastr.error("タグの更新に失敗しました");
            console.error("Tag update failed: ", response);
        }
    });
}

/**
 * アイテムIDからアップデートURLを取得する
 * @param {string|number} itemId アイテムID
 * @returns {string} アップデートURL
 */
function getUpdateUrlFromItemId(itemId) {
    const boardData = JSON.parse($("#kanban_board_data").val() || '[]');
    for (const board of boardData) {
        for (const item of board.item) {
            if (item.dataid == itemId) {
                return item.update_url;
            }
        }
    }
    return '';
}

/**
 * Appends click events to kanban item icons (like view details).
 */
function appendKanbanItemEvent() {
    $("#kanban").off("click", ".kanban-item-action.view-item").on("click", ".kanban-item-action.view-item", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        let itemElement = $(this).closest(".kanban-item");
        let url = getBoardUrl(itemElement, false) + "?modal=1";
        
        if (typeof Exment !== 'undefined' && Exment.ModalEvent && typeof Exment.ModalEvent.ShowModal === 'function') {
            Exment.ModalEvent.ShowModal($(this), url);
        } else {
            console.error('Exment.ModalEvent.ShowModal is not available.');
            window.open(url, '_blank');
        }
    });
}

/**
 * Gets the URL for a board item (for viewing details).
 */
function getBoardUrl($itemTarget, isWebApi) {
    const tableName = $itemTarget.data("table_name");
    const dataId = $itemTarget.data("dataid");
    if (!tableName || !dataId) {
        console.error("Missing data-table_name or data-dataid on kanban item:", $itemTarget);
        return '';
    }
    return admin_url(URLJoin('data', tableName, dataId));
}

/**
 * Gets the update URL for a kanban item.
 */
function getUpdateUrl($itemTarget) {
    const url = $itemTarget.data("update_url");
    if (!url) {
        console.error("Missing data-update_url on kanban item:", $itemTarget);
        return '';
    }
    return url;
}

/**
 * Merges item ID and table name into the data object for AJAX requests.
 */
function mergeIdAndTable($itemTarget, value) {
    value['id'] = $itemTarget.data("dataid");
    value['table_name'] = $itemTarget.data("table_name");
}

// The callJkanban() is initiated from kanban.blade.php within a jQuery $(function(){...}); block.
