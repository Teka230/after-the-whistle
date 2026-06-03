import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function run() {
  const url = process.argv[2];
  const transport = new StreamableHTTPClientTransport(new URL(url));
  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  const tools = await client.listTools();
  console.log(tools.tools.map(t => t.name).join(", "));
  const showGame = tools.tools.find(t => t.name === "show_game");
  if (showGame) {
    console.log("show_game tone properties:");
    console.log(JSON.stringify(showGame.inputSchema.properties.tone, null, 2));
  } else {
    console.log("no show_game tool found!");
  }
}
run().catch(console.error);
