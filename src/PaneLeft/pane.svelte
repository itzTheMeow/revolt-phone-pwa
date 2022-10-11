<script lang="ts">
  import ServerList from "./ServerList.svelte";
  import ChannelList from "./ChannelList.svelte";
  import Toolbar from "./Toolbar.svelte";
</script>

<div class="absolute top-0 left-0 h-full w-full flex">
  <div class="flex flex-col h-full w-full">
    <div class="flex flex-1 w-full" style="height:calc(100% - 2.5rem);">
      <ServerList />
      <ChannelList />
    </div>
    <Toolbar />
  </div>
</div>
