<div id="kanban"></div>

<input type="hidden" id="kanban_board_data" value="{{ json_encode($values) }}">
<input type="hidden" id="kanban_plugin_options" value="{{ isset($pluginOptions) ? json_encode($pluginOptions) : '{}' }}">

<script>
$(function(){
    if (typeof callJkanban === 'function') {
        callJkanban();
    } else {
        console.error('callJkanban function not found. Ensure jkanban-custom.js is loaded after jQuery and jKanban library.');
    }
});
</script>
