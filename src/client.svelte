<script lang="ts">
  import { afterUpdate, beforeUpdate, onMount } from "svelte";
  import { clearAllBodyScrollLocks, disableBodyScroll } from "body-scroll-lock";
  import { ChevronLeft, ChevronRight, ArrowBigRightLine } from "tabler-icons-svelte";
  import { escapeHTML, escapeRegex, Matches, proxyURL } from "util";
  import PaneLeft from "PaneLeft/pane.svelte";
  import { State } from "state.svelte";
  import { LIST_COLLAPSED, UI } from "ui";

  let inputtedMessage = "";
  let container: HTMLDivElement;
  let PaneMessages: HTMLDivElement, MessageInput: HTMLInputElement, sendButton: HTMLDivElement;

  const clientReady = new Promise((r) => State.client.once("ready", () => r(void 0)));

  let selectInput: HTMLInputElement | null = null;
  let previous = document.body.innerHTML;
  let pendBottom = false;
  afterUpdate(() => {
    if (pendBottom) {
      if (UI.ListMessages) UI.ListMessages.scrollTop = 9999;
      pendBottom = false;
    }
    if (previous == document.body.innerHTML) return;
    previous = document.body.innerHTML;
    //  clearAllBodyScrollLocks();
    [UI.ListServers, UI.ListChannels, UI.ListMessages].forEach((e) => e && disableBodyScroll(e));
    if (selectInput) {
      selectInput.focus();
      selectInput = null;
    }
  });

  function sendMessage() {
    if (!State.SelectedChannel || !inputtedMessage) {
      if (selectInput) {
        selectInput.focus();
        selectInput = null;
      }
      return;
    }
    const fc = sendButton.firstElementChild as HTMLDivElement;
    sendButton.classList.add("loading");
    fc.style.display = "none";
    State.SelectedChannel.sendMessage({
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
        ($LIST_COLLAPSED
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
        $LIST_COLLAPSED = left <= window.innerWidth / ($LIST_COLLAPSED ? 4 : 2);
        const n = $LIST_COLLAPSED ? "" : "100%";
        if (PaneMessages.style.left !== n) PaneMessages.style.left = n;
      }
      startedDragging = curPos = null;
      isSliding = false;
    });
  });
</script>

<div
  class="w-screen h-screen overflow-hidden"
  style="color:{State.themeSettings['foreground']};"
  bind:this={container}
>
  {#await clientReady}
    Logging in...
  {:then _}
    <PaneLeft />
    <div
      class="absolute top-0 left-0 w-full h-full bg-slate-600 flex flex-col"
      style="{$LIST_COLLAPSED ? '' : 'left: 100%;'}background-color:{State.themeSettings[
        'primary-background'
      ]}"
      bind:this={PaneMessages}
    >
      {#if State.SelectedChannel}
        <div class="overflow-y-auto flex-1 flex flex-col break-words" bind:this={UI.ListMessages}>
          {#if State.MessageCache[State.SelectedChannel._id]?.length}
            {#each State.MessageCache[State.SelectedChannel._id].slice(-75) as message}
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
                      const u = State.client.users.get(id);
                      return `<span style="color:${State.themeSettings["accent"]};">@${escapeHTML(
                        u?.username || "Unknown User"
                      )}</span>`;
                    })
                    .replace(escapeRegex(Matches.channel), (_, id) => {
                      const c = State.SelectedServer?.channels.find((c) => c?._id == id);
                      return `<span style="color:${State.themeSettings["accent"]};">#${escapeHTML(
                        c?.name || "unknown-channel"
                      )}</span>`;
                    })
                    .replace(escapeRegex(Matches.emojiCustom), (_, id) => {
                      const e = State.client.emojis.get(id);
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
                        src={proxyURL(State.client.generateFileURL(attachment), "image")}
                        alt={attachment.filename}
                      />
                    {:else if attachment.metadata.type == "Video"}
                      <!-- svelte-ignore a11y-media-has-caption -->
                      <video
                        src={proxyURL(State.client.generateFileURL(attachment), "any")}
                        alt={attachment.filename}
                        controls
                      />
                    {:else if attachment.metadata.type == "Audio"}
                      <audio
                        src={proxyURL(State.client.generateFileURL(attachment), "any")}
                        alt={attachment.filename}
                        controls
                      />
                    {:else}
                      <a href={State.client.generateFileURL(attachment)} target="_blank"
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
          style="background-color:{State.themeSettings['message-box']};"
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
            style="background-color:{State.themeSettings['accent']};"
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
      class="absolute {$LIST_COLLAPSED
        ? 'left-3'
        : 'right-3'} top-3 p-2 rounded-full bg-black flex items-center justify-center cursor-pointer aspect-square"
      style="background-color:{State.themeSettings.tooltip};"
      on:click={() => ($LIST_COLLAPSED = !$LIST_COLLAPSED)}
    >
      {#if $LIST_COLLAPSED}
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
