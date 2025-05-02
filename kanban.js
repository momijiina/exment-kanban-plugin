document.addEventListener('DOMContentLoaded', function() {
    // 優先度に応じたスタイルを適用
    const tasks = document.querySelectorAll('.task');
    tasks.forEach(task => {
        const priority = task.getAttribute('data-priority');
        if (priority) {
            task.classList.add(`priority-${priority}`);
            task.style.borderLeftColor = getPriorityColor(priority);
        }
        
        setupDragAndDrop(task);
    });
    
    // カラム数とカウントを更新
    updateColumnCounts();
    
    // タスク追加ボタンのイベントリスナー
    setupAddTaskForms();
});

function getPriorityColor(priority) {
    switch(priority) {
        case 'high': return '#f44336';
        case 'medium': return '#ff9800';
        case 'low': return '#4caf50';
        default: return '#999';
    }
}

function updateColumnCounts() {
    const columns = ['todo', 'in-progress', 'review', 'done'];
    columns.forEach(col => {
        const column = document.getElementById(col);
        const count = column.querySelectorAll('.task').length;
        const countEl = column.parentElement.querySelector('.task-count');
        countEl.textContent = count;
    });
}

function setupAddTaskForms() {
    const columns = ['todo', 'in-progress', 'review', 'done'];
    columns.forEach(col => {
        const addBtn = document.getElementById(`add-${col}-btn`);
        const form = document.getElementById(`add-${col}-form`);
        const title = document.getElementById(`${col}-title`);
        const desc = document.getElementById(`${col}-desc`);
        const submitBtn = document.getElementById(`${col}-add`);
        const cancelBtn = document.getElementById(`${col}-cancel`);
        
        // 「+タスクを追加」ボタンをクリック
        addBtn.addEventListener('click', function() {
            form.style.display = 'block';
            addBtn.style.display = 'none';
            title.focus();
        });
        
        // 「キャンセル」ボタンをクリック
        cancelBtn.addEventListener('click', function() {
            form.style.display = 'none';
            addBtn.style.display = 'block';
            title.value = '';
            desc.value = '';
        });
        
        // 「追加」ボタンをクリック
        submitBtn.addEventListener('click', function() {
            if (title.value.trim() !== '') {
                addNewTask(col, title.value, desc.value);
                form.style.display = 'none';
                addBtn.style.display = 'block';
                title.value = '';
                desc.value = '';
            }
        });
    });
}

function addNewTask(column, title, desc) {
    const task = document.createElement('div');
    task.className = 'task';
    task.setAttribute('draggable', 'true');
    task.setAttribute('data-priority', 'medium'); // デフォルトは中優先度
    task.setAttribute('data-owner', 'momijiina'); // 現在のユーザーを所有者に設定
    task.classList.add('priority-medium');
    task.style.borderLeftColor = getPriorityColor('medium');
    
    // GitHubアバターURLを使用
    const avatarUrl = 'https://avatars.githubusercontent.com/u/93751198?u=6594a55f10d4a970ab7fdf7df69967583a59dde4&v=4';
    
    task.innerHTML = `
        <div class="task-owner">
            <img src="${avatarUrl}" alt="momijiina">
        </div>
        <div class="task-content">
            <div class="task-title">${title}</div>
            <div class="task-desc">${desc}</div>
            <div class="task-footer">
                <div class="task-tags">
                    <span class="task-tag">新規</span>
                </div>
            </div>
        </div>
    `;
    
    const columnContent = document.getElementById(column);
    columnContent.appendChild(task);
    setupDragAndDrop(task);
    updateColumnCounts();
}

// ドラッグ＆ドロップ機能のセットアップ
function setupDragAndDrop(task) {
    task.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', ''); // Firefox対応
        this.classList.add('dragging');
        
        // ドラッグしているタスクの参照を保存
        window.draggedTask = this;
    });
    
    task.addEventListener('dragend', function() {
        this.classList.remove('dragging');
        window.draggedTask = null;
    });
}

// カラムコンテンツへのドロップ処理を設定
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.column-content').forEach(column => {
        column.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        });
        
        column.addEventListener('dragleave', function() {
            this.style.backgroundColor = '';
        });
        
        column.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.backgroundColor = '';
            
            // ドラッグしているタスクがあればこのカラムに移動
            if (window.draggedTask) {
                this.appendChild(window.draggedTask);
                updateColumnCounts();
            }
        });
    });
});
