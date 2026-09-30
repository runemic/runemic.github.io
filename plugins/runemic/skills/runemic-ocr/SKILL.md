---
name: runemic-ocr
description: Read text from page images (OCR) with Runemic, including non-Latin scripts (Arabic, Persian, Urdu, Hindi, Cyrillic, CJK), old scans, handwriting and tables. Use when the user wants an image or scanned page transcribed, or text extracted from a photo of a document.
---

# Reading pages with Runemic

Runemic returns a page's text in reading order, as Markdown (headings, lists and tables kept) or plain text.

## Which way to send the page

1. **The image is at a public https URL**: call the `read_page` tool of the `runemic` MCP server with `image` set to the URL.
2. **The image is a local file** (in the workspace or on the user's computer): don't paste base64 into a tool call, which is slow and costly for anything but tiny images. Call the REST API from the shell instead, with the user's key in `RUNEMIC_API_KEY`:

   ```sh
   curl -s https://api.runemic.com/v1/ocr \
     -H "Authorization: Bearer $RUNEMIC_API_KEY" \
     -F "file=@page.png" -F "format=markdown" | jq -r .text
   ```

   If `RUNEMIC_API_KEY` isn't set, ask the user to create a key at https://console.runemic.com and set it themselves. Never ask them to paste the key into the chat.
3. **The user attached the image in the chat**: tools can't receive it. Ask for the file path or a link.

## Rules

- One page per call. PDFs aren't supported yet: convert each page to PNG first (for example `pdftoppm -png -r 200 file.pdf page`) and send the pages in order.
- Images up to 4 MB: PNG, JPEG, WebP or GIF. Downscale larger scans (about 2000 px on the long side is plenty).
- Use `format: "text"` only when the user wants plain text; Markdown is the default.
- `instructions` (up to 300 characters) can narrow the output, for example "only the table".
- Each page costs $0.002–$0.003 of the user's Runemic credit; failed pages are free. `get_account` shows the balance and today's limit (500 pages a day during the preview; 20 requests a minute).
- On `429`, wait (honour `Retry-After`) and retry a few times at most. On `daily_limit`, stop and tell the user when it resets (00:00 UTC).
- Show the text as returned; don't "fix" spellings in historical or non-Latin text unless asked.
