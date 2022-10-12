<script lang="ts">
  import { Client } from "revolt.js";
  import type { Server, Channel, Message } from "revolt.js";
  import { afterUpdate, onMount } from "svelte";
  import { disableBodyScroll } from "body-scroll-lock";
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
  import { escapeHTML, escapeRegex, Matches, proxyURL } from "util";
  import TWEEN from "@tweenjs/tween.js";

  function logout() {
    localStorage.removeItem("session");
    window.location.reload();
  }

  requestAnimationFrame(function animate(time: number) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
  });

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
  const fetchedMembers = new Set();
  let SelectedServer: Server, SelectedChannel: Channel;
  let MessageCache: { [key: string]: Message[] } = {};
  let container: HTMLDivElement;
  let PaneMessages: HTMLDivElement, MessageInput: HTMLInputElement, sendButton: HTMLDivElement;
  let ListServers: HTMLDivElement, ListChannels: HTMLDivElement, ListMessages: HTMLDivElement;
  const pushMessages = (channel: Channel, msgs: Message[]) => {
    MessageCache[channel._id] = (MessageCache[channel._id] || []).filter(
      (c) => !msgs.find((m) => m._id == c._id)
    );
    MessageCache[channel._id].push(...msgs);
    MessageCache[channel._id].sort((m1, m2) => m1.createdAt - m2.createdAt);
    if (SelectedChannel?._id == channel._id) MessageCache = MessageCache;
  };

  const client = new Client({ autoReconnect: true });
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
    if (MessageCache[message.channel_id]) pushMessages(message.channel!, [message]);
  });
  client.useExistingSession(JSON.parse(session)).catch(() => logout());

  let selectInput: HTMLInputElement | null = null;
  let previous = document.body.innerHTML;
  let pendBottom = false;
  afterUpdate(() => {
    if (pendBottom) {
      if (ListMessages) ListMessages.scrollTop = 9999;
      pendBottom = false;
    }
    if (previous == document.body.innerHTML) return;
    previous = document.body.innerHTML;
    [ListServers, ListChannels, ListMessages].forEach(
      (e) => e && disableBodyScroll(e, { allowTouchMove: () => true })
    );
    if (selectInput) {
      selectInput.focus();
      selectInput = null;
    }
  });

  function sendMessage() {
    if (!SelectedChannel || !inputtedMessage) {
      if (selectInput) {
        selectInput.focus();
        selectInput = null;
      }
      return;
    }
    const fc = sendButton.firstElementChild as HTMLDivElement;
    sendButton.classList.add("loading");
    fc.style.display = "none";
    SelectedChannel.sendMessage({
      content: inputtedMessage,
    }).then(() => {
      sendButton.classList.remove("loading");
      fc.style.display = "";
    });
    pendBottom = true;
    inputtedMessage = "";
  }

  onMount(() => {
    let startedDragging: [number, number] | null = null;
    let curPos: [number, number] | null = null;
    let isSliding = false;
    container.addEventListener("touchstart", (e) => {
      isSliding = false;
      if (
        document.activeElement?.tagName == "INPUT" &&
        (e.changedTouches[0].target as HTMLElement).tagName == "INPUT"
      )
        return;
      startedDragging = [e.changedTouches[0].pageX, e.changedTouches[0].pageY];
    });
    container.addEventListener("touchmove", (e) => {
      if (!startedDragging) return;
      if (
        document.activeElement?.tagName == "INPUT" &&
        (e.changedTouches[0].target as HTMLElement).tagName == "INPUT"
      )
        return;
      curPos = [e.changedTouches[0].pageX, e.changedTouches[0].pageY];
      if (
        Math.abs(curPos[1] - startedDragging[1]) <= 15 &&
        (LIST_COLLAPSED
          ? curPos[0] - startedDragging[0] >= 20
          : startedDragging[0] - curPos[0] >= 20)
      )
        isSliding = true;
      if (isSliding) {
        const x = curPos[0];
        PaneMessages.style.left = `${Math.max(0, Math.min(window.innerWidth, x))}px`;
      }
    });
    container.addEventListener("touchend", () => {
      if (isSliding) {
        const left = Number(PaneMessages.style.left.replace("px", ""));
        LIST_COLLAPSED = left <= window.innerWidth / (LIST_COLLAPSED ? 4 : 2);
        const n = LIST_COLLAPSED ? "" : "100%";
        if (PaneMessages.style.left !== n) PaneMessages.style.left = n;
      }
      startedDragging = curPos = null;
      isSliding = false;
    });
  });
</script>

<div
  class="w-screen h-screen overflow-hidden"
  style="color:{themeSettings['foreground']};"
  bind:this={container}
>
  {#await clientReady}
    Logging in...
  {:then _}
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
                on:click={() => (
                  (SelectedServer = server),
                  !fetchedMembers.has(SelectedServer._id) &&
                    (fetchedMembers.add(SelectedServer._id),
                    SelectedServer.fetchMembers().then(() => (MessageCache = MessageCache)))
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
                          SelectedChannel,
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
      style="{LIST_COLLAPSED ? '' : 'left: 100%;'}background-color:{themeSettings[
        'primary-background'
      ]}"
      bind:this={PaneMessages}
    >
      {#if SelectedChannel}
        <div class="overflow-y-auto flex-1 flex flex-col break-words" bind:this={ListMessages}>
          {#if MessageCache[SelectedChannel._id]?.length}
            {#each MessageCache[SelectedChannel._id].slice(-75) as message}
              <div class="mb-3 last:mb-0">
                <div
                  class="font-semibold"
                  style="color:{message.masquerade?.colour ||
                    message.member?.orderedRoles.find((r) => r[1].colour)?.[1].colour ||
                    'inherit'};"
                >
                  {message.masquerade?.name || message.member?.nickname || message.author?.username}
                </div>
                <div class="whitespace-pre-wrap">
                  {@html escapeHTML(message.content || "")
                    .replace(escapeRegex(Matches.user), (_, id) => {
                      const u = client.users.get(id);
                      return `<span style="color:${themeSettings["accent"]};">@${escapeHTML(
                        u?.username || "Unknown User"
                      )}</span>`;
                    })
                    .replace(escapeRegex(Matches.channel), (_, id) => {
                      const c = SelectedServer.channels.find((c) => c?._id == id);
                      return `<span style="color:${themeSettings["accent"]};">#${escapeHTML(
                        c?.name || "unknown-channel"
                      )}</span>`;
                    })
                    .replace(escapeRegex(Matches.emojiCustom), (_, id) => {
                      const e = client.emojis.get(id);
                      if (!e) return _;
                      return `<img src="${proxyURL(
                        e.imageURL,
                        "image"
                      )}" class="inline object-contain ${
                        message.content == _ ? "h-12 w-12" : "h-5 w-5"
                      } -mx-0.5 align-middle" />`;
                    })}
                </div>
                {#each message.attachments || [] as attachment}
                  <div class="rounded mt-2" style="max-width:90%;">
                    {#if attachment.metadata.type == "Image"}
                      <img
                        class="block"
                        src={proxyURL(client.generateFileURL(attachment), "image")}
                        alt={attachment.filename}
                        style="width:{attachment.metadata.width}px;height:{attachment.metadata
                          .height};"
                      />
                    {:else if attachment.metadata.type == "Video"}
                      <!-- svelte-ignore a11y-media-has-caption -->
                      <video
                        class="block"
                        src={proxyURL(client.generateFileURL(attachment), "any")}
                        alt={attachment.filename}
                        controls
                        style="width:{attachment.metadata.width}px;height:{attachment.metadata
                          .height};"
                      />
                    {:else if attachment.metadata.type == "Audio"}
                      <audio
                        class="block"
                        src={proxyURL(client.generateFileURL(attachment), "any")}
                        alt={attachment.filename}
                        controls
                      />
                    {:else}
                      <a href={client.generateFileURL(attachment)} target="_blank"
                        >Download {attachment.filename}</a
                      >
                    {/if}
                  </div>
                {/each}
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
            type="text"
            autocomplete="on"
            bind:this={MessageInput}
            bind:value={inputtedMessage}
            on:keyup={(e) => {
              if (e.key == "Enter") sendMessage();
            }}
          />
          <div
            class="btn btn-square btn-primary rounded-none border-none"
            style="background-color:{themeSettings['accent']};"
            on:click={() => (
              document.activeElement?.tagName !== "INPUT" && (selectInput = MessageInput),
              sendMessage()
            )}
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
  {/await}
</div>

<style>
  .overflow-y-auto {
    -webkit-overflow-scrolling: touch;
  }
</style>
