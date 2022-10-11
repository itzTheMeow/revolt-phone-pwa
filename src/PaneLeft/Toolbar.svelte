<script lang="ts">
  import { State } from "state.svelte";
  import { Logout, Refresh, Settings } from "tabler-icons-svelte";
  import { logout } from "util";
</script>

<div
  class="h-10 flex items-center justify-center bg-slate-900"
  style="background-color:{State.themeSettings['tooltip']};"
>
  <div class="cursor-pointer mr-2"><Settings size={28} /></div>
  <div class="cursor-pointer mr-2" on:click={() => window.location.reload()}>
    <Refresh size={28} />
  </div>
  <div
    class="cursor-pointer"
    on:click={() => confirm("Are you sure you want to log out?") && logout()}
  >
    <Logout size={28} />
  </div>
</div>
