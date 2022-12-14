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
    Paperclip,
    CircleX,
    PhoneCall,
    Microphone,
    MicrophoneOff,
    Headphones,
    HeadphonesOff,
    PhoneOff,
  } from "tabler-icons-svelte";
  import { escapeHTML, escapeRegex, Matches, proxyURL } from "./util";
  import TWEEN from "@tweenjs/tween.js";
  import { uploadAttachment, parseAutocomplete, type ThemeSettings } from "revolt-toolset";
  import type { AutocompleteResult, AutocompleteTabResult } from "revolt-toolset/dist/autocomplete";
  import AutocompleteItem from "AutocompleteItem.svelte";
  import { voiceState as VOICE_STATE, VoiceStatus } from "./voice/VoiceState";

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

  let themeSettings: ThemeSettings = JSON.parse(localStorage.getItem("theme") || "{}");
  let LIST_COLLAPSED = false;
  let fileInput: HTMLInputElement;

  let inputtedMessage = "",
    uploadedFiles: { name: string; type: string; url: string; data: File }[] = [];
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
      if (ListMessages) ListMessages.scrollTop = ListMessages.scrollHeight * 2;
      pendBottom = false;
    }
    if (previous == document.body.innerHTML) return;
    previous = document.body.innerHTML;
    [ListServers, ListChannels, ListMessages, AutocompletePanel].forEach(
      (e) => e && disableBodyScroll(e, { allowTouchMove: () => true })
    );
    if (selectInput) {
      selectInput.focus();
      selectInput = null;
    }
  });

  async function sendMessage() {
    if (!SelectedChannel || (!inputtedMessage && !uploadedFiles.length)) {
      if (selectInput) {
        selectInput.focus();
        selectInput = null;
      }
      return;
    }
    const content = inputtedMessage ? inputtedMessage : null;
    const fc = sendButton.firstElementChild as HTMLDivElement;
    sendButton.classList.add("loading");
    fc.style.display = "none";
    pendBottom = true;
    inputtedMessage = "";
    const toUpload = [...uploadedFiles];
    uploadedFiles.splice(0);
    uploadedFiles = uploadedFiles;
    const attachments: string[] = [];
    for (const attachment of toUpload) {
      try {
        const id = await uploadAttachment(attachment.name, attachment.data);
        if (id) attachments.push(id);
      } catch (err) {
        console.error("no attachment", err);
      }
    }
    const message = await SelectedChannel.sendMessage({
      content,
      attachments: attachments.length ? attachments : null,
    });
    sendButton.classList.remove("loading");
    fc.style.display = "";
    pendBottom = true;
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
  let MessageInputSelected = false,
    autocomplete: AutocompleteResult | null,
    AutocompletePanel: HTMLDivElement;
  function recalculateAutocomplete() {
    if (!MessageInputSelected) return (autocomplete = null);
    autocomplete = parseAutocomplete(
      SelectedServer,
      inputtedMessage,
      MessageInput.selectionStart || 0
    );
  }
  function handleAutocomplete(e: KeyboardEvent) {
    if (autocomplete?.size && (e.key == "Enter" || e.key == "Tab")) {
      e.preventDefault();
      handleAutocompleteTab(
        autocomplete.tab(
          [...autocomplete.channels, ...autocomplete.emojis, ...autocomplete.users][0]
        )
      );
      recalculateAutocomplete();
      return true;
    }
    return false;
  }
  function handleAutocompleteTab(res: AutocompleteTabResult | undefined) {
    if (!res) return;
    inputtedMessage = res.text;
    MessageInput.focus();
    MessageInput.setSelectionRange(res.newCursor, res.newCursor);
    recalculateAutocomplete();
  }

  let voiceState = VOICE_STATE;
  VOICE_STATE.events.on("stateChange", () => (voiceState = voiceState));
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
                style="background-color:{themeSettings['hover']};{SelectedServer?._id == server._id
                  ? `border: 1px solid ${themeSettings['accent']};`
                  : ''}"
                on:click={() => {
                  SelectedServer = server;
                  if (!fetchedMembers.has(SelectedServer._id)) {
                    fetchedMembers.add(SelectedServer._id);
                    if (SelectedServer._id == "01F7ZSBSFHQ8TA81725KQCSDDP")
                      return alert(
                        "Revolt Lounge member fetching is disabled. (crashes app)\nThink you can fix it? Make a pull request! itzTheMeow/revolt-phone-pwa on GitHub."
                      );
                    SelectedServer.fetchMembers().then(() => (MessageCache = MessageCache));
                  }
                }}
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
                        const m = await channel.fetchMessages({
                          limit: 100,
                        });
                        pendBottom = true;
                        pushMessages(SelectedChannel, m);
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
        {#if SelectedChannel.channel_type !== "VoiceChannel"}
          <div
            class="overflow-y-auto flex-1 flex flex-col break-words p-1.5"
            bind:this={ListMessages}
          >
            {#if MessageCache[SelectedChannel._id]?.length}
              {#each MessageCache[SelectedChannel._id].slice(-75) as message}
                <div>
                  {#if MessageCache[SelectedChannel._id][MessageCache[SelectedChannel._id].indexOf(message) - 1]?.author_id !== message.author_id}
                    <div
                      class="font-semibold mt-2"
                      style="color:{message.masquerade?.colour ||
                        message.member?.orderedRoles.find((r) => r[1].colour)?.[1].colour ||
                        'inherit'};"
                    >
                      {message.masquerade?.name ||
                        message.member?.nickname ||
                        message.author?.username}
                    </div>
                  {/if}
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
                    <div
                      class="rounded mt-2 block"
                      style="max-width:90vw;{['width', 'height']
                        .map(
                          (h) =>
                            h +
                            ':' +
                            Math.floor(
                              Math.min(
                                1,
                                Math.min(
                                  //@ts-ignore
                                  (window.innerWidth * 0.9) / attachment.metadata.width,
                                  //@ts-ignore
                                  (window.innerHeight * 0.7) / attachment.metadata.height
                                )
                              ) *
                                //@ts-ignore
                                attachment.metadata[h]
                            ) +
                            'px'
                        )
                        .join(';')}"
                    >
                      {#if attachment.metadata.type == "Image"}
                        <img
                          class="block rounded"
                          src={proxyURL(
                            client.generateFileURL(attachment, {
                              width: Math.floor(window.innerWidth * 0.9),
                            }),
                            "image"
                          )}
                          alt={attachment.filename}
                        />
                      {:else if attachment.metadata.type == "Video"}
                        <!-- svelte-ignore a11y-media-has-caption -->
                        <video
                          class="block"
                          src={proxyURL(client.generateFileURL(attachment), "any")}
                          alt={attachment.filename}
                          controls
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
          {#if uploadedFiles.length}
            <div
              class="bg-slate-900 flex py-2 overflow-x-auto w-full"
              style="height:20%;background-color:{themeSettings['primary-header']};"
            >
              {#each uploadedFiles as file}
                <div
                  class="relative rounded bg-white bg-opacity-25 flex items-center justify-center mx-1 h-full cursor-pointer"
                  on:click={() => {
                    const i = uploadedFiles.indexOf(file);
                    if (i >= 0) uploadedFiles.splice(i, 1);
                    URL.revokeObjectURL(file.url);
                    uploadedFiles = uploadedFiles;
                  }}
                >
                  {#if file.type == "image"}
                    <img src={file.url} alt={file.name} class="h-full rounded" />
                  {:else}
                    <div class="m-1.5">{file.name}</div>
                  {/if}
                  <div
                    class="rounded absolute top-0 left-0 h-full w-full bg-black bg-opacity-25 flex items-center justify-center text-error"
                  >
                    <CircleX />
                  </div>
                </div>
              {/each}
            </div>
          {/if}
          {#if autocomplete?.size}
            <div
              class="bg-slate-900 overflow-y-auto py-2 w-full"
              style="max-height:35%;background-color:{themeSettings['primary-header']};"
              bind:this={AutocompletePanel}
            >
              {#each autocomplete.channels.slice(0, 15) as c}
                <AutocompleteItem
                  icon={c.icon
                    ? proxyURL(c.generateIconURL({ max_side: 64 }), "image")
                    : c.channel_type == "VoiceChannel"
                    ? Volume
                    : Hash}
                  name={c.name || ""}
                  onclick={() => handleAutocompleteTab(autocomplete?.tab(c))}
                />
              {/each}
              {#each autocomplete.emojis.slice(0, 15) as e}
                <AutocompleteItem
                  icon={proxyURL(e.imageURL, "image")}
                  name={e.name || ""}
                  detail={e.parent.type == "Server"
                    ? client.servers.get(e.parent.id)?.name || ""
                    : ""}
                  onclick={() => handleAutocompleteTab(autocomplete?.tab(e))}
                />
              {/each}
              {#each autocomplete.users.slice(0, 15) as u}
                <AutocompleteItem
                  icon={proxyURL(
                    u.generateAvatarURL({ max_side: 64 }) ||
                      u.user?.generateAvatarURL({ max_side: 64 }),
                    "image"
                  )}
                  name={u.nickname || u.user?.username || ""}
                  detail={u.user?.username || ""}
                  rounded
                  onclick={() => handleAutocompleteTab(autocomplete?.tab(u))}
                />
              {/each}
            </div>
          {/if}
          <div
            class="bg-slate-800 h-12 flex w-full"
            style="background-color:{themeSettings['message-box']};"
          >
            <input
              type="file"
              class="hidden"
              bind:this={fileInput}
              multiple
              on:change={() => {
                const files = [...(fileInput.files || [])];
                files.forEach((file) => {
                  if (uploadedFiles.length >= 5) return;
                  uploadedFiles.push({
                    name: file.name,
                    type: file.type.split("/")[0],
                    url: URL.createObjectURL(file),
                    data: file,
                  });
                  uploadedFiles = uploadedFiles;
                });
              }}
            />
            <div
              class="btn btn-square btn-secondary rounded-none border-none"
              style="background-color:{themeSettings['primary-header']};"
              on:click={() => fileInput.click()}
            >
              <Paperclip />
            </div>
            <input
              class="flex-1 bg-inherit p-1"
              style="outline:none;"
              type="text"
              autocomplete="on"
              bind:this={MessageInput}
              bind:value={inputtedMessage}
              on:keydown={handleAutocomplete}
              on:keyup={(e) => {
                if (handleAutocomplete(e)) return;
                if (e.key == "Enter") sendMessage();
                recalculateAutocomplete();
              }}
              on:touchmove={() => recalculateAutocomplete()}
              on:touchend={() => recalculateAutocomplete()}
              on:mouseup={() => recalculateAutocomplete()}
              on:click={() => (MessageInputSelected = true)}
              on:focus={() => (MessageInputSelected = true)}
              on:focusin={() => (MessageInputSelected = true)}
              on:blur={() => (MessageInputSelected = false)}
            />
            <div
              class="btn btn-square btn-primary rounded-none border-none"
              style="background-color:{themeSettings['accent']};"
              on:touchstart={() => {
                if (document.activeElement?.tagName == "INPUT")
                  //@ts-ignore
                  selectInput = document.activeElement;
              }}
              on:click={() => {
                sendMessage();
              }}
              bind:this={sendButton}
            >
              <ArrowBigRightLine />
            </div>
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center w-full h-full">
            {#await voiceState.loadVoice()}
              <div>Loading...</div>
            {:then _}
              <div class="mb-auto mt-3 text-lg font-semibold">{SelectedChannel.name}</div>
              {#if voiceState.status == VoiceStatus.CONNECTED}
                <div class="flex">
                  {#each [...voiceState.participants.keys()] as uid}
                    <div class="relative w-16 h-16 mx-2">
                      <img
                        src={proxyURL(
                          client.users.get(uid)?.generateAvatarURL({ max_side: 256 }),
                          "image"
                        )}
                        alt={client.users.get(uid)?.username}
                        class="rounded-full w-full h-full"
                      />
                      {#if (client.user?._id === uid && voiceState.isDeaf()) || !voiceState.participants.get(uid)?.audio}
                        <div class="absolute right-0 bottom-0 p-1 bg-error rounded-full">
                          {#if client.user?._id === uid && voiceState.isDeaf()}
                            <HeadphonesOff size={14} />
                          {:else if !voiceState.participants.get(uid)?.audio}
                            <MicrophoneOff size={14} />
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else if voiceState.status == VoiceStatus.LOADING}
                <div>Loading...</div>
              {:else if voiceState.status == VoiceStatus.AUTHENTICATING}
                <div>Authenticating...</div>
              {:else if voiceState.status == VoiceStatus.CONNECTING}
                <div>Connecting...</div>
              {:else if voiceState.status == VoiceStatus.RTC_CONNECTING}
                <div>RTC Connecting...</div>
              {/if}
              <div class="mt-auto mb-4 flex items-center">
                {#if voiceState.status == VoiceStatus.READY}
                  <div
                    class="p-3 bg-success inline-flex items-center justify-center rounded-full cursor-pointer"
                    on:click={async () => {
                      try {
                        await voiceState.connect(SelectedChannel);
                      } catch (err) {
                        alert("WebRTC is probably not enabled in settings!\n" + err);
                      }
                    }}
                  >
                    <PhoneCall size={20} />
                  </div>
                {:else if voiceState.status == VoiceStatus.CONNECTED}
                  {#if voiceState.isProducing("audio")}
                    <div
                      class="p-3 bg-slate-900 inline-flex items-center justify-center rounded-full cursor-pointer"
                      style="background-color:{themeSettings['tooltip']};"
                      on:click={async () => {
                        await voiceState.stopProducing("audio");
                        voiceState = voiceState;
                      }}
                    >
                      <Microphone size={20} />
                    </div>
                  {:else}
                    <div
                      class="p-3 bg-slate-900 inline-flex items-center justify-center rounded-full cursor-pointer"
                      style="background-color:{themeSettings['tooltip']};"
                      on:click={async () => {
                        await voiceState.startProducing("audio");
                        voiceState = voiceState;
                      }}
                    >
                      <MicrophoneOff size={20} />
                    </div>
                  {/if}
                  {#if voiceState.isDeaf()}
                    <div
                      class="mx-1.5 p-3 bg-slate-900 inline-flex items-center justify-center rounded-full cursor-pointer"
                      style="background-color:{themeSettings['tooltip']};"
                      on:click={async () => {
                        await voiceState.stopDeafen();
                        voiceState = voiceState;
                      }}
                    >
                      <HeadphonesOff size={20} />
                    </div>
                  {:else}
                    <div
                      class="mx-1.5 p-3 bg-slate-900 inline-flex items-center justify-center rounded-full cursor-pointer"
                      style="background-color:{themeSettings['tooltip']};"
                      on:click={async () => {
                        await voiceState.startDeafen();
                        voiceState = voiceState;
                      }}
                    >
                      <Headphones size={20} />
                    </div>
                  {/if}
                  <div
                    class="p-3 bg-error inline-flex items-center justify-center rounded-full cursor-pointer"
                    on:click={async () => {
                      voiceState.disconnect();
                      voiceState = voiceState;
                    }}
                  >
                    <PhoneOff size={20} />
                  </div>
                {/if}
              </div>
            {/await}
          </div>
        {/if}
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
