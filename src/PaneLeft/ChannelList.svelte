<script lang="ts">
  import { State, pushMessages } from "state.svelte";
  import { Hash, Volume } from "tabler-icons-svelte";
  import { UI, LIST_COLLAPSED } from "ui";
  import { proxyURL } from "util";
</script>

<div
  class="bg-slate-700 overflow-y-auto flex-1 h-full"
  style="background-color:{State.themeSettings['secondary-background']}"
  bind:this={UI.ListChannels}
>
  {#if State.SelectedServer}
    {#each State.SelectedServer.orderedChannels as category}
      {#if State.SelectedServer.orderedChannels.indexOf(category) && category.title !== "Default"}
        <div
          class="text-lg text-primary ml-2 mb-1 font-bold"
          style="color:{State.themeSettings.accent};"
        >
          {category.title}
        </div>
      {/if}
      {#each category.channels as channel}
        <div
          class="cursor-pointer m-1.5 p-2 rounded flex items-center box-border"
          style="background-color:{State.themeSettings['hover']};{State.SelectedChannel?._id ==
          channel._id
            ? `border: 1px solid ${State.themeSettings['accent']};`
            : ''}"
          on:click={async () => {
            State.SelectedChannel = channel;
            $LIST_COLLAPSED = true;
            UI.pendBottom = true;
            if (!State.MessageCache[State.SelectedChannel._id]?.length) {
              pushMessages(
                State.SelectedChannel,
                await channel.fetchMessages({
                  limit: 100,
                })
              );
              UI.pendBottom = true;
            }
          }}
        >
          {#if channel.icon}
            <img
              src={proxyURL(channel.generateIconURL({ max_side: 64 }), "image")}
              width="20"
              height="20"
              class="object-cover aspect-square"
              alt=""
            />
          {:else if channel.channel_type == "TextChannel"}
            <Hash size={20} />
          {:else if channel.channel_type == "VoiceChannel"}
            <Volume size={20} />
          {/if}
          <span class="ml-1">{channel.name}</span>
        </div>
      {/each}
    {/each}
  {:else}
    Select a server!
  {/if}
</div>
