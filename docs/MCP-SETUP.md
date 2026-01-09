# MCP Server Setup

This document describes the Model Context Protocol (MCP) server configuration for the Singularity Blog project.

## Overview

MCP servers extend Claude Code's capabilities by providing additional tools. This project uses MCP servers for:

1. **Web Crawling**: Puppeteer MCP for dynamic page rendering
2. **File System**: Enhanced file operations
3. **Custom Operations**: Project-specific tools (optional)

## Required MCP Servers

### 1. Puppeteer MCP Server

**Purpose**: Handle JavaScript-rendered pages and dynamic content

**Installation**:
```bash
# Install globally
npm install -g @anthropics/mcp-server-puppeteer

# Or use npx (no installation required)
npx @anthropics/mcp-server-puppeteer
```

**Configuration** (`~/.claude/settings.json` or project `.claude/settings.json`):
```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["@anthropics/mcp-server-puppeteer"],
      "env": {
        "PUPPETEER_HEADLESS": "true"
      }
    }
  }
}
```

**Available Tools**:
| Tool | Description |
|------|-------------|
| `puppeteer_navigate` | Navigate to a URL |
| `puppeteer_screenshot` | Take page screenshot |
| `puppeteer_click` | Click an element |
| `puppeteer_fill` | Fill form input |
| `puppeteer_evaluate` | Execute JavaScript |

**Usage Example**:
```
Use puppeteer to:
1. Navigate to the gallery page
2. Wait for posts to load
3. Extract post list HTML
```

### 2. Filesystem MCP Server

**Purpose**: Enhanced file operations with better error handling

**Installation**:
```bash
npm install -g @anthropics/mcp-server-filesystem
```

**Configuration**:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "@anthropics/mcp-server-filesystem",
        "/home/kkaemo/projects/singularity-blog"
      ]
    }
  }
}
```

**Available Tools**:
| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Write file contents |
| `list_directory` | List directory contents |
| `create_directory` | Create new directory |
| `move_file` | Move/rename file |
| `search_files` | Search files by pattern |

---

## Complete Configuration

### User-Level Configuration (`~/.claude/settings.json`)

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["@anthropics/mcp-server-puppeteer"],
      "env": {
        "PUPPETEER_HEADLESS": "true",
        "PUPPETEER_TIMEOUT": "30000"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "@anthropics/mcp-server-filesystem",
        "/home/kkaemo/projects"
      ]
    }
  }
}
```

### Project-Level Configuration (`.claude/settings.json`)

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["@anthropics/mcp-server-puppeteer"],
      "env": {
        "PUPPETEER_HEADLESS": "true"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "@anthropics/mcp-server-filesystem",
        "/home/kkaemo/projects/singularity-blog"
      ]
    }
  }
}
```

---

## Optional: Custom MCP Server

For advanced use cases, you can create a custom MCP server for project-specific operations.

### Custom Server Structure

```
packages/mcp-server/
├── src/
│   ├── index.ts
│   ├── tools/
│   │   ├── crawl-gallery.ts
│   │   ├── verify-post.ts
│   │   └── translate-post.ts
│   └── types.ts
├── package.json
└── tsconfig.json
```

### Example Custom Tool Implementation

```typescript
// packages/mcp-server/src/tools/crawl-gallery.ts
import { Tool } from '@anthropics/mcp-sdk';

export const crawlGalleryTool: Tool = {
  name: 'crawl_gallery',
  description: 'Crawl posts from DC Inside singularity gallery',
  parameters: {
    type: 'object',
    properties: {
      pages: {
        type: 'number',
        description: 'Number of pages to crawl',
        default: 1
      },
      category: {
        type: 'string',
        description: 'Category filter (optional)'
      }
    }
  },
  handler: async ({ pages = 1, category }) => {
    // Implementation
    const posts = await crawlGallery(pages, category);
    return { posts, count: posts.length };
  }
};
```

### Custom Server Configuration

```json
{
  "mcpServers": {
    "singularity": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "cwd": "/home/kkaemo/projects/singularity-blog"
    }
  }
}
```

---

## Troubleshooting

### Puppeteer Issues

**Problem**: Chrome not found
```bash
# Install Chrome dependencies (Ubuntu/Debian)
sudo apt-get install -y chromium-browser

# Or let Puppeteer download Chrome
npx puppeteer browsers install chrome
```

**Problem**: Sandbox errors
```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["@anthropics/mcp-server-puppeteer"],
      "env": {
        "PUPPETEER_HEADLESS": "true",
        "PUPPETEER_ARGS": "--no-sandbox,--disable-setuid-sandbox"
      }
    }
  }
}
```

### Filesystem Issues

**Problem**: Permission denied
- Ensure the filesystem MCP has access to required directories
- Check file permissions: `chmod -R 755 /path/to/project`

**Problem**: Path not allowed
- MCP filesystem only accesses paths specified in args
- Add additional paths to the args array if needed

### General MCP Issues

**Problem**: MCP server not starting
```bash
# Test MCP server manually
npx @anthropics/mcp-server-puppeteer

# Check for port conflicts
lsof -i :3000
```

**Problem**: Tools not appearing
1. Restart Claude Code after configuration changes
2. Check settings.json syntax (valid JSON)
3. Verify MCP server package is installed

---

## Verification

### Test MCP Setup

1. **Puppeteer Test**:
```
Use Puppeteer to navigate to https://example.com and take a screenshot
```

2. **Filesystem Test**:
```
List all files in the data/ directory
```

### Expected Output

When MCP servers are properly configured, you should see:
- Additional tools available in Claude Code
- No errors when invoking MCP tools
- Proper results from MCP operations

---

## Security Considerations

1. **Puppeteer**:
   - Run in headless mode in production
   - Avoid exposing sensitive data in screenshots
   - Set appropriate timeouts

2. **Filesystem**:
   - Limit access to specific directories
   - Don't expose system directories
   - Be careful with write permissions

3. **Custom MCP**:
   - Validate all inputs
   - Use environment variables for secrets
   - Log operations for debugging
