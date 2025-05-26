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
                ->help('かんばんのタイトルとして表示する列を選択してください。指定しない場合はデフォルトのラベルが使用されます。');

            // 詳細表示用のカラム選択を追加
            $form->select('detail_column', '詳細表示列')
                ->options($this->custom_table->custom_columns->pluck('column_view_name', 'id'))
                ->help('かんばんのタイトルの下に表示する詳細テキストの列を選択してください。');
                
            // アバター表示用のカラム選択を追加
            $form->select('avatar_column', 'アバター表示列')
                ->options($this->custom_table->custom_columns->pluck('column_view_name', 'id'))
                ->help('かんばんのタイトルの上に表示するアバターの元となるユーザー情報を持つ列を選択してください。作成者列やユーザー列を選択すると効果的です。');
                
            // タグ選択用のカラム選択を追加
            $form->select('tag_column', 'タグ列')
                ->options($this->custom_table->getFilteredTypeColumns([ColumnType::SELECT, ColumnType::SELECT_VALTEXT])->pluck('column_view_name', 'id'))
                ->help('かんばんに表示するタグの選択肢を持つ列を選択してください。カスタム列種類「選択肢」「選択肢(値・見出し)」が候補に表示されます。');
                
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
        
        // アバター表示用カラムのIDを取得
        $avatar_column_id = $this->custom_view->getCustomOption('avatar_column');
        $avatar_column = null;
        if ($avatar_column_id) {
            $avatar_column = CustomColumn::getEloquent($avatar_column_id);
            if (!$avatar_column) {
                Log::warning('KanbanView Plugin: Avatar column with ID ' . $avatar_column_id . ' not found.');
            }
        }
        
        // タグ列のIDを取得
        $tag_column_id = $this->custom_view->getCustomOption('tag_column');
        $tag_column = null;
        $tag_options = [];
        if ($tag_column_id) {
            $tag_column = CustomColumn::getEloquent($tag_column_id);
            if ($tag_column) {
                $tag_options = $tag_column->createSelectOptions();
            } else {
                Log::warning('KanbanView Plugin: Tag column with ID ' . $tag_column_id . ' not found.');
            }
        }
        
        $allow_multiple_tags = true;

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
                
                // タグの現在の値を取得
                $current_tags = [];
                if ($tag_column && isset($item->value[$tag_column->column_name])) {
                    $tag_value = $item->value[$tag_column->column_name];
                    
                    // デバッグログ出力
                    Log::debug('KanbanView Plugin: Tag value for item ID ' . $item->id . ': ' . json_encode($tag_value));
                    
                    // 配列の場合
                    if (is_array($tag_value)) {
                        // 複数選択の場合（配列の配列）
                        if (isset($tag_value[0]) && is_array($tag_value[0])) {
                            foreach ($tag_value as $tv) {
                                if (isset($tv['key'])) {
                                    $current_tags[] = $tv['key'];
                                } elseif (isset($tv['id'])) {
                                    $current_tags[] = $tv['id'];
                                } elseif (isset($tv['value'])) {
                                    $current_tags[] = $tv['value'];
                                }
                            }
                        } 
                        // 単一選択の場合（キー・値ペアの配列）
                        elseif (isset($tag_value['key'])) {
                            $current_tags[] = $tag_value['key'];
                        } elseif (isset($tag_value['id'])) {
                            $current_tags[] = $tag_value['id'];
                        } elseif (isset($tag_value['value'])) {
                            $current_tags[] = $tag_value['value'];
                        }
                        // 単純な値の配列の場合
                        else {
                            foreach ($tag_value as $tv) {
                                if (is_scalar($tv) && !empty($tv)) {
                                    $current_tags[] = $tv;
                                }
                            }
                        }
                    } 
                    // スカラー値の場合
                    elseif (is_scalar($tag_value) && !empty($tag_value)) {
                        $current_tags[] = $tag_value;
                    }
                    
                    // デバッグログ出力
                    Log::debug('KanbanView Plugin: Parsed current_tags for item ID ' . $item->id . ': ' . json_encode($current_tags));
                }

                // アバター情報を取得
                $avatar_info = null;
                
                // デバッグログ出力
                Log::debug('KanbanView Plugin: Processing avatar for item ID ' . $item->id);
                
                // デフォルトアバター画像のパス
                $default_avatar_url = url('vendor/exment/images/user.png');
                
                if ($avatar_column && isset($item->value[$avatar_column->column_name])) {
                    $avatar_value = $item->value[$avatar_column->column_name];
                    
                    // デバッグログ出力
                    Log::debug('KanbanView Plugin: Avatar raw value: ' . json_encode($avatar_value));
                    
                    // ユーザーIDの場合（数値または文字列の数値）
                    if (is_numeric($avatar_value) || (is_string($avatar_value) && is_numeric($avatar_value))) {
                        // ユーザーIDからユーザーオブジェクトを取得
                        $user_id = (int)$avatar_value;
                        Log::debug('KanbanView Plugin: Detected user ID: ' . $user_id);
                        
                        try {
                            // Authクラスを使用してユーザーを取得
                            $user = \Exceedone\Exment\Model\LoginUser::find($user_id);
                            
                            if ($user) {
                                Log::debug('KanbanView Plugin: Found user by ID: ' . $user_id . ', name: ' . $user->user_name);
                                
                                $avatar_url = null;
                                
                                // ユーザーのアバター画像を取得
                                if ($user->avatar) {
                                    // 正しいURLパターン: admin/files/{uuid}
                                    $avatar_url = url('admin/files/' . $user->avatar);
                                    Log::debug('KanbanView Plugin: User avatar URL set to: ' . $avatar_url);
                                } else {
                                    // アバターが設定されていない場合はデフォルト画像を使用
                                    $avatar_url = $default_avatar_url;
                                    Log::debug('KanbanView Plugin: User has no avatar, using default');
                                }
                                
                                $avatar_info = [
                                    'name' => $user->user_name ?? '',
                                    'email' => $user->email ?? '',
                                    'avatar' => $avatar_url,
                                ];
                            } else {
                                Log::debug('KanbanView Plugin: User not found for ID: ' . $user_id);
                            }
                        } catch (\Exception $e) {
                            Log::error('KanbanView Plugin: Error fetching user: ' . $e->getMessage());
                        }
                    }
                    // ユーザー情報の場合
                    elseif (is_array($avatar_value) && isset($avatar_value['email'])) {
                        $avatar_url = null;
                        
                        // avatar_urlがある場合はそれを使用
                        if (isset($avatar_value['avatar_url']) && !empty($avatar_value['avatar_url'])) {
                            $avatar_url = $avatar_value['avatar_url'];
                        } 
                        // avatarがある場合はそれを使用
                        elseif (isset($avatar_value['avatar']) && !empty($avatar_value['avatar'])) {
                            // 正しいURLパターン: admin/files/{uuid}
                            $avatar_url = url('admin/files/' . $avatar_value['avatar']);
                        } else {
                            // アバター情報がない場合はデフォルト画像を使用
                            $avatar_url = $default_avatar_url;
                        }
                        
                        // URLが相対パスの場合、絶対パスに変換
                        if ($avatar_url && strpos($avatar_url, 'http') !== 0 && strpos($avatar_url, '/') === 0) {
                            $avatar_url = url($avatar_url);
                        }
                        
                        $avatar_info = [
                            'name' => $avatar_value['name'] ?? '',
                            'email' => $avatar_value['email'] ?? '',
                            'avatar' => $avatar_url,
                        ];
                    } 
                    // 作成者情報の場合
                    elseif (is_array($avatar_value) && isset($avatar_value['created_user'])) {
                        $user_info = $avatar_value['created_user'];
                        $avatar_url = null;
                        
                        // avatar_urlがある場合はそれを使用
                        if (isset($user_info['avatar_url']) && !empty($user_info['avatar_url'])) {
                            $avatar_url = $user_info['avatar_url'];
                        } 
                        // avatarがある場合はそれを使用
                        elseif (isset($user_info['avatar']) && !empty($user_info['avatar'])) {
                            // 正しいURLパターン: admin/files/{uuid}
                            $avatar_url = url('admin/files/' . $user_info['avatar']);
                        } else {
                            // アバター情報がない場合はデフォルト画像を使用
                            $avatar_url = $default_avatar_url;
                        }
                        
                        // URLが相対パスの場合、絶対パスに変換
                        if ($avatar_url && strpos($avatar_url, 'http') !== 0 && strpos($avatar_url, '/') === 0) {
                            $avatar_url = url($avatar_url);
                        }
                        
                        $avatar_info = [
                            'name' => $user_info['name'] ?? '',
                            'email' => $user_info['email'] ?? '',
                            'avatar' => $avatar_url,
                        ];
                    }
                    // 名前のみの場合
                    elseif (is_scalar($avatar_value) && !empty($avatar_value)) {
                        $avatar_info = [
                            'name' => (string)$avatar_value,
                            'email' => '',
                            'avatar' => $default_avatar_url, // デフォルト画像を使用
                        ];
                    }
                }
                
                // 作成者情報を使用　なぜか取得できないが放置
                if (!$avatar_info && isset($item->created_user)) {
                    $avatar_url = null;
                    
                    // デバッグログ出力
                    Log::debug('KanbanView Plugin: Using created_user as fallback: ' . json_encode($item->created_user));
                    
                    // avatar_urlがある場合はそれを使用
                    if (isset($item->created_user['avatar_url']) && !empty($item->created_user['avatar_url'])) {
                        $avatar_url = $item->created_user['avatar_url'];
                    } 
                    // avatarがある場合はそれを使用
                    elseif (isset($item->created_user['avatar']) && !empty($item->created_user['avatar'])) {
                        // 正しいURLパターン: admin/files/{uuid}
                        $avatar_url = url('admin/files/' . $item->created_user['avatar']);
                    } else {
                        // アバター情報がない場合はデフォルト画像を使用
                        $avatar_url = $default_avatar_url;
                    }
                    
                    // URLが相対パスの場合、絶対パスに変換
                    if ($avatar_url && strpos($avatar_url, 'http') !== 0 && strpos($avatar_url, '/') === 0) {
                        $avatar_url = url($avatar_url);
                    }
                    
                    $avatar_info = [
                        'name' => $item->created_user['name'] ?? '',
                        'email' => $item->created_user['email'] ?? '',
                        'avatar' => $avatar_url,
                    ];
                }
                
                // アバター情報がない場合は最低限の情報を設定
                if (!$avatar_info) {
                    $avatar_info = [
                        'name' => 'User',
                        'email' => '',
                        'avatar' => $default_avatar_url,
                    ];
                }
                
                // デバッグログ出力
                Log::debug('KanbanView Plugin: Final avatar_info: ' . json_encode($avatar_info));

                $board['item'][] = [
                    'id' => "item-id-".$item->id,
                    'title' => $task_title,
                    'detail' => $task_detail, // 詳細テキストをアイテムデータに追加
                    'dataid' => $item->id,
                    'table_name' => $this->custom_table->table_name,
                    'update_url' => $update_url,
                    'original_item_data' => $item->toArray(),
                    'avatar_info' => $avatar_info, // アバター情報を追加
                    'tag_column' => $tag_column ? $tag_column->column_name : null,
                    'tag_options' => $tag_options,
                    'current_tags' => $current_tags,
                    'allow_multiple_tags' => $allow_multiple_tags,
                    'raw_tag_value' => $tag_column && isset($item->value[$tag_column->column_name]) ? $item->value[$tag_column->column_name] : null // デバッグ用に生のタグ値も保存
                ];
            }
        }
        return $boards;
    }
}
