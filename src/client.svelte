<script lang="ts">
  import { Client } from "revolt.js";
  import type { Server, Channel, Message } from "revolt.js";
  import { afterUpdate } from "svelte";
  import { clearAllBodyScrollLocks, disableBodyScroll } from "body-scroll-lock";
  import {
    Settings,
    Logout,
    ChevronLeft,
    ChevronRight,
    Hash,
    Volume,
    Refresh,
    ArrowBigRightLine,
  } from "tabler-icons-svelte";

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
  let PaneMessages: HTMLDivElement, sendButton: HTMLDivElement;
  let ListServers: HTMLDivElement, ListChannels: HTMLDivElement, ListMessages: HTMLDivElement;
  const pushMessages = (id: string, msgs: Message[]) => {
    MessageCache[id] = (MessageCache[id] || []).filter((c) => !msgs.find((m) => m._id == c._id));
    MessageCache[id].push(...msgs);
    MessageCache[id].sort((m1, m2) => m1.createdAt - m2.createdAt);
    if (SelectedChannel?._id == id) MessageCache = MessageCache;
  };

  const client = new Client();
  const clientReady = new Promise((r) => client.once("ready", () => r(void 0)));
  client.once("ready", async () => {
    try {
      localStorage.setItem(
        "theme",
        JSON.stringify(
          (themeSettings =
            JSON.parse((await client.syncFetchSettings(["theme"])).theme[1])[
              "appearance:theme:overrides"
            ] || {})
        )
      );
    } catch {}
  });
  client.on("message", (message) => {
    if (MessageCache[message.channel_id]) pushMessages(message.channel_id, [message]);
  });
  client.useExistingSession(JSON.parse(session)).catch(() => logout());

  let previous = document.body.innerHTML;
  let pendBottom = false;
  afterUpdate(() => {
    if (pendBottom) {
      if (ListMessages) ListMessages.scrollTop = 9999;
      pendBottom = false;
    }
    if (previous == document.body.innerHTML) return;
    previous = document.body.innerHTML;
    clearAllBodyScrollLocks();
    [ListServers, ListChannels, ListMessages].forEach((e) => e && disableBodyScroll(e));
  });

  function sendMessage() {
    if (!SelectedChannel || !inputtedMessage) return;
    const fc = sendButton.firstElementChild as HTMLDivElement;
    sendButton.classList.add("loading");
    fc.style.display = "none";
    SelectedChannel.sendMessage({
      content: inputtedMessage,
    }).then(() => {
      sendButton.classList.remove("loading");
      fc.style.display = "";
    });
    inputtedMessage = "";
  }

  let startedDragging: [number, number] | null = null;
  let curPos: [number, number] | null = null;
  let isSliding = false;
  window.addEventListener("touchstart", (e) => {
    isSliding = false;
    startedDragging = [e.changedTouches[0].pageX, e.changedTouches[0].pageY];
  });
  window.addEventListener("touchmove", (e) => {
    curPos = [e.changedTouches[0].pageX, e.changedTouches[0].pageY];
    if (!startedDragging) startedDragging = [...curPos];
    if (
      Math.abs(curPos[1] - startedDragging[1]) <= 15 &&
      (LIST_COLLAPSED ? curPos[0] - startedDragging[0] >= 20 : startedDragging[0] - curPos[0] >= 20)
    )
      isSliding = true;
    if (isSliding) {
      const x = curPos[0];
      PaneMessages.style.left = `${Math.max(0, Math.min(window.innerWidth, x))}px`;
    }
  });
  window.addEventListener("touchend", (e) => {
    const left = Number(PaneMessages.style.left.replace("px", ""));
    LIST_COLLAPSED = left <= window.innerWidth / (LIST_COLLAPSED ? 4 : 2);
    PaneMessages.style.left = LIST_COLLAPSED ? "" : "100%";
    startedDragging = curPos = null;
    isSliding = false;
  });
</script>

{#await clientReady}
  Logging in...
{:then _}
  <div class="w-screen h-screen overflow-hidden" style="color:{themeSettings['foreground']};">
    <div class="absolute top-0 left-0 h-full w-full flex">
      <div class="flex flex-col h-full w-full">
        <div class="flex flex-1 w-full" style="height:calc(100% - 2.5rem);">
          <div
            class="bg-slate-800 overflow-y-auto h-full"
            style="width:40%;max-width:25rem;background-color:{themeSettings['background']}"
            bind:this={ListServers}
          >
            {#each [...client.servers.values()].sort( (s1, s2) => (s1.name.toLowerCase() > s2.name.toLowerCase() ? 1 : -1) ) as server}
              <div
                class="flex items-center p-2 m-2 rounded bg-black bg-opacity-20 cursor-pointer"
                style="background-color:{themeSettings['hover']};"
                on:click={() => (SelectedServer = server)}
              >
                <div class="avatar mr-2">
                  <div class="w-5 rounded-full">
                    <img src={server.generateIconURL()} alt="" crossorigin="anonymous" />
                  </div>
                </div>
                <div class="overflow-hidden overflow-ellipsis whitespace-pre">{server.name}</div>
              </div>
            {/each}
          </div>
          <div
            class="bg-slate-700 overflow-y-auto flex-1 h-full"
            style="background-color:{themeSettings['secondary-background']}"
            bind:this={ListChannels}
          >
            {#if SelectedServer}
              {#each SelectedServer.orderedChannels as category}
                {#if SelectedServer.orderedChannels.indexOf(category) && category.title !== "Default"}
                  <div
                    class="text-lg text-primary ml-2 mb-1 font-bold"
                    style="color:{themeSettings.accent};"
                  >
                    {category.title}
                  </div>
                {/if}
                {#each category.channels as channel}
                  <div
                    class="cursor-pointer m-1.5 p-2 rounded flex items-center box-border"
                    style="background-color:{themeSettings['hover']};{SelectedChannel?._id ==
                    channel._id
                      ? `border: 1px solid ${themeSettings['accent']};`
                      : ''}"
                    on:click={async () => {
                      SelectedChannel = channel;
                      LIST_COLLAPSED = true;
                      pendBottom = true;
                      if (!MessageCache[SelectedChannel._id]?.length) {
                        pushMessages(
                          SelectedChannel._id,
                          await channel.fetchMessages({
                            limit: 100,
                          })
                        );
                        pendBottom = true;
                      }
                    }}
                  >
                    {#if channel.icon}
                      <img
                        src={channel.generateIconURL()}
                        loading="lazy"
                        width="20"
                        height="20"
                        class="object-cover aspect-square"
                        alt=""
                        crossorigin="anonymous"
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
        </div>
        <div
          class="h-10 flex items-center justify-center bg-slate-900"
          style="background-color:{themeSettings['tooltip']};"
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
      </div>
    </div>
    <div
      class="absolute top-0 left-0 w-full h-full bg-slate-600 flex flex-col"
      style="transition:left 150ms;{LIST_COLLAPSED
        ? ''
        : 'left: 100%;'}background-color:{themeSettings['primary-background']}"
      bind:this={PaneMessages}
    >
      {#if SelectedChannel}
        <div class="overflow-y-auto flex-1 flex flex-col break-words" bind:this={ListMessages}>
          {#if MessageCache[SelectedChannel._id]?.length}
            {#each MessageCache[SelectedChannel._id].slice(-75) as message}
              <div class="mb-3 last:mb-0">
                <div>{message.author?.username}</div>
                <div class="whitespace-pre-wrap">> {message.content}</div>
              </div>
            {/each}
          {:else}
            ...
          {/if}
        </div>
        <div
          class="bg-slate-800 h-12 flex"
          style="background-color:{themeSettings['message-box']};"
        >
          <input
            class="flex-1 bg-inherit"
            bind:value={inputtedMessage}
            on:keyup={(e) => {
              if (e.key == "Enter") sendMessage();
            }}
          />
          <div
            class="btn btn-square btn-primary rounded-none"
            style="background-color:{themeSettings['accent']};"
            on:click={sendMessage}
            bind:this={sendButton}
          >
            <ArrowBigRightLine />
          </div>
        </div>
      {:else}
        Select a channel!
      {/if}
    </div>

    <div
      class="absolute {LIST_COLLAPSED
        ? 'left-3'
        : 'right-3'} top-3 p-2 rounded-full bg-black flex items-center justify-center cursor-pointer aspect-square"
      style="background-color:{themeSettings.tooltip};"
      on:click={() => (LIST_COLLAPSED = !LIST_COLLAPSED)}
    >
      {#if LIST_COLLAPSED}
        <ChevronLeft />
      {:else}
        <ChevronRight />
      {/if}
    </div>
  </div>
{/await}

<style>
  .overflow-y-auto {
    -webkit-overflow-scrolling: touch;
  }
</style>
