<script lang="ts">
  import { State } from "../state.svelte";
  import { UI, LIST_COLLAPSED } from "../ui";
  import { proxyURL } from "util";
</script>

<div
  class="bg-slate-800 overflow-y-auto h-full"
  style="width:40%;max-width:25rem;background-color:{State.themeSettings['background']}"
  bind:this={UI.ListServers}
>
  {#each [...State.client.servers.values()].sort( (s1, s2) => (s1.name.toLowerCase() > s2.name.toLowerCase() ? 1 : -1) ) as server}
    <div
      class="flex items-center p-2 m-2 rounded bg-black bg-opacity-20 cursor-pointer"
      style="background-color:{State.themeSettings['hover']};"
      on:click={() => (
        ($LIST_COLLAPSED = !$LIST_COLLAPSED),
        (State.SelectedServer = server),
        !State.fetchedMembers.has(State.SelectedServer._id) &&
          (State.fetchedMembers.add(State.SelectedServer._id),
          State.SelectedServer.fetchMembers().then(() => (State.MessageCache = State.MessageCache)))
      )}
    >
      <div class="avatar mr-2">
        <div class="w-5 rounded-full">
          <img
            src={proxyURL(server.generateIconURL({ max_side: 64 }), "image")}
            alt={server.name
              .split(" ")
              .map((a) => a[0].toUpperCase())
              .join("")}
            class="before:text-sm before:font-bold before:align-text-top before:flex before:justify-center"
          />
        </div>
      </div>
      <div class="overflow-hidden overflow-ellipsis whitespace-pre">{server.name}</div>
    </div>
  {/each}
</div>
