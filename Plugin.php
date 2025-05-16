<?php

namespace App\Plugins\KanbanView;

use Exceedone\Exment\Services\Plugin\PluginViewBase;
use Exceedone\Exment\Enums\ColumnType;
use Exceedone\Exment\Model\CustomTable;
use Exceedone\Exment\Model\CustomColumn;
use Illuminate\Support\Facades\Log;

class Plugin extends PluginViewBase
{
    public function grid()
    {
        $values = $this->values();
        $pluginOptions = $this->custom_view->custom_options ?? [];
        return $this->pluginView('kanban', ['values' => $values, 'pluginOptions' => $pluginOptions]);
    }

    public function update(){
        $value = request()->get('value');
        $custom_table = CustomTable::getEloquent(request()->get('table_name'));
        $custom_value = $custom_table->getValueModel(request()->get('id'));
        $custom_value->setValue($value)->save();
        return response()->json($custom_value);
    }

    public function setViewOptionForm($form)
    {
        $form->embeds('custom_options', '詳細設定', function($form){
            $form->select('category', 'カテゴリ列')
                ->options($this->custom_table->getFilteredTypeColumns([ColumnType::SELECT, ColumnType::SELECT_VALTEXT])->pluck('column_view_name', 'id'))
                ->required()
                ->help('カテゴリ列を選択してください。カンバンのボードに該当します。カスタム列種類「選択肢」「選択肢(値・見出し)」が候補に表示されます。');

            $form->select('title_column', 'タイトル列')
                ->options($this->custom_table->custom_columns->pluck('column_view_name', 'id'))
                ->help('かんばんカードのタイトルとして表示する列を選択してください。指定しない場合はデフォルトのラベルが使用されます。');

            // 詳細表示用のカラム選択を追加
            $form->select('detail_column', '詳細表示列')
                ->options($this->custom_table->custom_columns->pluck('column_view_name', 'id'))
                ->help('かんばんカードのタイトルの下に表示する詳細テキストの列を選択してください。');
        });
        static::setFilterFields($form, $this->custom_table);
        static::setSortFields($form, $this->custom_table);
    }

    protected function values(){
        $query = $this->custom_table->getValueQuery();
        $this->custom_view->filterModel($query);
        $this->custom_view->sortModel($query);
        $items = collect();
        $query->chunk(1000, function($values) use(&$items){
            $items = $items->merge($values);
        });
        $boards = $this->getBoardItems($items);
        return $boards;
    }

    protected function getBoardItems($items){
        $category_column_id = $this->custom_view->getCustomOption('category');
        if (!$category_column_id) {
            Log::error('KanbanView Plugin: Category column ID is not set in plugin options.');
            return [];
        }
        $category = CustomColumn::getEloquent($category_column_id);
        if (!$category) {
            Log::error('KanbanView Plugin: Category column with ID ' . $category_column_id . ' not found. It might have been deleted or the ID is incorrect.');
            return [];
        }
        $options = $category->createSelectOptions();
        $update_url = $this->plugin->getFullUrl('update');
        $title_column_id = $this->custom_view->getCustomOption('title_column');
        $title_column = null;
        if ($title_column_id) {
            $title_column = CustomColumn::getEloquent($title_column_id);
            if (!$title_column) {
                Log::warning('KanbanView Plugin: Title column with ID ' . $title_column_id . ' not found. Default item label will be used.');
            }
        }

        // 詳細表示カラムのIDを取得
        $detail_column_id = $this->custom_view->getCustomOption('detail_column');
        $detail_column = null;
        if ($detail_column_id) {
            $detail_column = CustomColumn::getEloquent($detail_column_id);
            if (!$detail_column) {
                Log::warning('KanbanView Plugin: Detail column with ID ' . $detail_column_id . ' not found.');
            }
        }

        $boards_dragTo = collect($options)->map(function($option, $key){
            return "board-id-".$key;
        })->toArray();
        $boards = collect($options)->map(function($option, $key) use($category, $boards_dragTo){
            return [
                'id' => "board-id-".$key,
                'column_name' => $category->column_name,
                'key' => $key,
                'title' => $option,
                'drapTo' => $boards_dragTo,
                'item' => [],
            ];
        })->values()->toArray();
        foreach($items as $item){
            $c = array_get($item, 'value.' . $category->column_name);
            foreach($boards as &$board){
                if(!isMatchString($c, $board['key'])){
                    continue;
                }
                $task_title = $item->getLabel();
                if ($title_column && isset($item->value[$title_column->column_name])) {
                    $title_value = $item->value[$title_column->column_name];
                    if (!empty($title_value)) {
                        if (is_array($title_value) && isset($title_value['label'])) {
                            $task_title = $title_value['label'];
                        } elseif (is_scalar($title_value)) {
                            $task_title = (string)$title_value;
                        } else {
                             Log::warning('KanbanView Plugin: Title column value for item ID ' . $item->id . ' is not a scalar or expected array format. Falling back to default label.');
                             $task_title = $item->getLabel();
                        }
                    }
                }

                // 詳細テキストを取得
                $task_detail = '';
                if ($detail_column && isset($item->value[$detail_column->column_name])) {
                    $detail_value = $item->value[$detail_column->column_name];
                    if (is_array($detail_value) && isset($detail_value['label'])) {
                        $task_detail = $detail_value['label'];
                    } elseif (is_scalar($detail_value)) {
                        $task_detail = (string)$detail_value;
                    } else {
                        Log::warning('KanbanView Plugin: Detail column value for item ID ' . $item->id . ' is not a scalar or expected array format.');
                    }
                }

                $board['item'][] = [
                    'id' => "item-id-".$item->id,
                    'title' => $task_title,
                    'detail' => $task_detail, // 詳細テキストをアイテムデータに追加
                    'dataid' => $item->id,
                    'table_name' => $this->custom_table->table_name,
                    'update_url' => $update_url,
                    'original_item_data' => $item->toArray()
                ];
            }
        }
        return $boards;
    }
}
