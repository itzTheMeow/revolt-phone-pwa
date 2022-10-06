<script lang="ts">
  import { Client } from "revolt.js";
  import type { Server, Channel, Message } from "revolt.js";
  import { afterUpdate, onMount } from "svelte";
  import { clearAllBodyScrollLocks, disableBodyScroll, enableBodyScroll } from "body-scroll-lock";

  function logout() {
    localStorage.removeItem("session");
    window.location.reload();
  }

  const session = localStorage.getItem("session")!;
  try {
    JSON.parse(session);
  } catch {
    logout();
  }

  // prettier-ignore
  let themeSettings: {accent?: string;background?: string;block?: string;error?: string;foreground?: string;hover?: string;mention?: string;"message-box"?: string;"primary-background"?: string;"primary-header"?: string;"scrollbar-thumb"?: string;"secondary-background"?: string;"secondary-foreground"?: string;"secondary-header"?: string;"status-away"?: string;"status-busy"?: string;"status-invisible"?: string;"status-online"?: string;success?: string;"tertiary-background"?: string;"tertiary-foreground"?: string;warning?: string;tooltip?: string;"scrollbar-track"?: string;"status-focus"?: string;"status-streaming"?: string;light?: boolean;} = JSON.parse(localStorage.getItem("theme") || "{}");
  let LIST_COLLAPSED = false;

  let inputtedMessage = "";
  let SelectedServer: Server, SelectedChannel: Channel;
  let MessageCache: { [key: string]: Message[] } = {};
  let ListServers: HTMLDivElement, ListChannels: HTMLDivElement, ListMessages: HTMLDivElement;

  const client = new Client();
  const clientReady = new Promise((r) => client.once("ready", () => r(void 0)));
  client.once("ready", async () => {
    try {
      localStorage.setItem(
        "theme",
        JSON.stringify(
          (themeSettings = JSON.parse((await client.syncFetchSettings(["theme"])).theme[1])[
            "appearance:theme:overrides"
          ])
        )
      );
    } catch {}
  });
  client.on("message", (message) => {
    if (MessageCache[message.channel_id]) {
      MessageCache[message.channel_id].unshift(message);
      if (SelectedChannel?._id == message.channel_id) MessageCache = MessageCache;
    }
  });
  client.useExistingSession(JSON.parse(session)).catch(() => logout());

  let previous = document.body.innerHTML;
  afterUpdate(() => {
    if (previous == document.body.innerHTML) return;
    previous = document.body.innerHTML;
    clearAllBodyScrollLocks();
    [ListServers, ListChannels, ListMessages].forEach((e) => e && disableBodyScroll(e));
  });
</script>

{#await clientReady}
  Logging in...
{:then _}
  <div class="w-screen h-screen overflow-hidden" style="color:{themeSettings['foreground']};">
    <div class="absolute top-0 left-0 h-full w-full flex">
      <div
        class="bg-slate-800 overflow-y-auto"
        style="width:40%;background-color:{themeSettings['background']}"
        bind:this={ListServers}
      >
        {#each [...client.servers.values()].sort( (s1, s2) => (s1.name.toLowerCase() > s2.name.toLowerCase() ? 1 : -1) ) as server}
          <div
            class="flex items-center p-2 mb-2 last:mb-0 bg-slate-900 cursor-pointer"
            on:click={() => (SelectedServer = server)}
          >
            <div class="avatar mr-2">
              <div class="w-5 rounded-full">
                <img src={server.generateIconURL({ size: 64 })} alt="" />
              </div>
            </div>
            <div class="overflow-hidden overflow-ellipsis whitespace-pre">{server.name}</div>
          </div>
        {/each}
      </div>
      <div
        class="bg-slate-700 overflow-y-auto"
        style="width:60%;background-color:{themeSettings['secondary-background']}"
        bind:this={ListChannels}
      >
        {#if SelectedServer}
          {#each SelectedServer.orderedChannels as category}
            <div>{category.title}</div>
            {#each category.channels as channel}
              <div
                class="cursor-pointer"
                on:click={async () => {
                  SelectedChannel = channel;
                  LIST_COLLAPSED = true;
                  if (!MessageCache[SelectedChannel._id]?.length)
                    MessageCache[SelectedChannel._id] = await channel.fetchMessages({ limit: 100 });
                }}
              >
                {channel.name}
              </div>
            {/each}
          {/each}
        {:else}
          Select a server!
        {/if}
      </div>
    </div>
    <div
      class="absolute top-0 left-0 w-full h-full bg-slate-600 flex flex-col"
      style="{LIST_COLLAPSED ? '' : 'left: 100%;'}background-color:{themeSettings[
        'primary-background'
      ]}"
    >
      {#if SelectedChannel}
        <div class="overflow-y-auto flex-1 flex flex-col-reverse" bind:this={ListMessages}>
          {#if MessageCache[SelectedChannel._id]?.length}
            {#each MessageCache[SelectedChannel._id] as message}
              <div class="mb-3 last:mb-0">
                <div>{message.author?.username}</div>
                <div>> {message.content}</div>
              </div>
            {/each}
          {:else}
            ...
          {/if}
        </div>
        <input
          class="bg-slate-800 h-12"
          style="background-color:{themeSettings['message-box']};"
          bind:value={inputtedMessage}
          on:keyup={(e) => {
            if (e.key == "Enter") {
              SelectedChannel.sendMessage({
                content: inputtedMessage,
              });
              inputtedMessage = "";
            }
          }}
        />
      {:else}
        Select a channel!
      {/if}
    </div>

    <div
      class="absolute right-3 top-3 p-2 rounded-full bg-black w-3 h-3"
      on:click={() => (LIST_COLLAPSED = !LIST_COLLAPSED)}
    >
      {#if LIST_COLLAPSED}
        {">"}
      {:else}
        {"<"}
      {/if}
    </div>
  </div>
{/await}

<style>
  .overflow-y-auto {
    -webkit-overflow-scrolling: touch;
  }
</style>
