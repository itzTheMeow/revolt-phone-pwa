<script lang="ts" context="module">
  import { Channel, Client, Message, Server } from "revolt.js";
  import { logout } from "util";

  const session = localStorage.getItem("session")!;
  try {
    JSON.parse(session);
  } catch {
    logout();
  }

  const client = new Client({ autoReconnect: true });
  client.once("ready", async () => {
    try {
      localStorage.setItem(
        "theme",
        JSON.stringify(
          (State.themeSettings =
            JSON.parse((await client.syncFetchSettings(["theme"])).theme[1])[
              "appearance:theme:overrides"
            ] || {})
        )
      );
    } catch {}
  });
  client.on("message", (message) => {
    if (State.MessageCache[message.channel_id]) pushMessages(message.channel!, [message]);
  });
  client.useExistingSession(JSON.parse(session)).catch(() => logout());

  export function pushMessages(channel: Channel, msgs: Message[]) {
    State.MessageCache[channel._id] = (State.MessageCache[channel._id] || []).filter(
      (c) => !msgs.find((m) => m._id == c._id)
    );
    State.MessageCache[channel._id].push(...msgs);
    State.MessageCache[channel._id].sort((m1, m2) => m1.createdAt - m2.createdAt);
    if (State.SelectedChannel?._id == channel._id) State.MessageCache = State.MessageCache;
  }

  interface IState {
    // prettier-ignore
    themeSettings: {accent?: string;background?: string;block?: string;error?: string;foreground?: string;hover?: string;mention?: string;"message-box"?: string;"primary-background"?: string;"primary-header"?: string;"scrollbar-thumb"?: string;"secondary-background"?: string;"secondary-foreground"?: string;"secondary-header"?: string;"status-away"?: string;"status-busy"?: string;"status-invisible"?: string;"status-online"?: string;success?: string;"tertiary-background"?: string;"tertiary-foreground"?: string;warning?: string;tooltip?: string;"scrollbar-track"?: string;"status-focus"?: string;"status-streaming"?: string;light?: boolean;} ;
    client: Client;
    MessageCache: { [key: string]: Message[] };
    SelectedServer: Server | null;
    SelectedChannel: Channel | null;
    fetchedMembers: Set<string>;
  }
  export const State: IState = {
    client,
    themeSettings: JSON.parse(localStorage.getItem("theme") || "{}"),
    MessageCache: {},
    SelectedServer: null,
    SelectedChannel: null,
    fetchedMembers: new Set(),
  };
</script>
