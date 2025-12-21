# @atriumn/idynic-mcp

MCP (Model Context Protocol) server for [Idynic](https://idynic.com) - your AI career companion.

## Installation

```bash
npm install -g @atriumn/idynic-mcp
```

Or run directly with npx:

```bash
npx @atriumn/idynic-mcp
```

## Configuration

### Environment Variables

- `IDYNIC_API_KEY` (required): Your Idynic API key
- `IDYNIC_API_URL` (optional): API base URL (defaults to https://idynic.com/api/v1)

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "idynic": {
      "command": "npx",
      "args": ["@atriumn/idynic-mcp"],
      "env": {
        "IDYNIC_API_KEY": "idn_your_api_key_here"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_profile` | Get your full profile |
| `update_profile` | Update contact information |
| `get_claims` | Get your identity claims (skills, education, etc.) |
| `list_opportunities` | List tracked job opportunities |
| `get_opportunity` | Get details of a specific opportunity |
| `add_opportunity` | Add a new job opportunity |
| `analyze_match` | Get match analysis for a job |
| `get_tailored_profile` | Get tailored profile for a job |
| `create_share_link` | Create shareable link for a profile |
| `add_and_tailor` | Add job + generate tailored profile |
| `add_tailor_share` | Add + tailor + create share link |

## Available Resources

| URI | Description |
|-----|-------------|
| `idynic://profile` | Your profile data |
| `idynic://claims` | Your identity claims |
| `idynic://opportunities` | Your tracked opportunities |
| `idynic://opportunities/{id}` | Specific opportunity |
| `idynic://opportunities/{id}/match` | Match analysis |
| `idynic://opportunities/{id}/tailored` | Tailored profile |
| `idynic://work-history` | Your work history |

## Getting an API Key

1. Log in to [Idynic](https://idynic.com)
2. Go to Settings > API Keys
3. Create a new key
4. Copy the key (it's only shown once!)

## License

MIT
