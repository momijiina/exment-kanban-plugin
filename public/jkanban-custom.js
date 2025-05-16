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
            <div class="kanban-item-header">
                <span class="kanban-item-text">%s</span>
            </div>
            <div class="kanban-item-detail-text"></div> 
            <div class="kanban-item-details-placeholder"></div> 
        </div>
        <div class="kanban-item-icon">
            <a href="javascript:void(0);" class="kanban-item-action view-item" title="詳細表示"><i class="fa fa-eye"></i></a>
            <i class="fa fa-arrows-alt item_handle kanban-drag-handle-icon" title="移動"></i>
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

    if ($detailTextElement.length > 0 && itemData.detail) {
        $detailTextElement.text(itemData.detail); // Display the detail text
    }

    if ($detailsPlaceholder.length === 0) return; // Should not happen if template is correct

    let detailsHtml = '';

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
