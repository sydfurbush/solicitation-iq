**Analysis result**

Do I know what the issue is? Yes.

The failed document is the RFQ DOCX for solicitation `7d1c6a0c-2717-4e54-9076-e1a590c25b65`. The document parsing step succeeds: text is extracted successfully (`42,655` characters). The failure happens afterward in the entity extraction function.

**What is actually happening**

- `process-document` downloads and parses the uploaded DOCX correctly.
- It then calls `extract-entities`.
- `extract-entities` calls the AI gateway using forced tool-call structured output.
- The deployed function log shows the failed run used:
  - model: `google/gemini-2.5-flash`
  - max tokens: `4096`
  - finish reason: `error`
  - tool argument chars: `0`
- Because the AI response contained no tool call, the function marked the document as `failed` with: `AI did not return structured tool call`.

**Why the prior fix did not take effect**

The code fallback was changed to `google/gemini-2.5-pro`, but this app has a runtime database override table called `ai_model_settings`. That override still says:

```text
extract-entities -> google/gemini-2.5-flash, max_tokens 4096
```

The shared AI client checks that override first, so the deployed function ignored the new static code fallback and kept using Flash. That is why it failed again.

**Plan to fix**

1. Update the runtime AI model setting for `extract-entities`
   - Set provider to `lovable`.
   - Set model to `google/gemini-2.5-pro`.
   - Raise max tokens from `4096` to `16000` to match the intended code config and reduce structured-output truncation risk.

2. Harden the code path so this mismatch is less likely to recur
   - Keep the current Pro fallback in `_shared/aiClient.ts`.
   - Add clearer logging that identifies when a runtime override is being used.
   - Optionally make the Settings UI default for Entity Extraction show `16000` instead of `4096` so admins do not unknowingly save the weaker value again.

3. Retry only the failed current document
   - Re-run processing for the failed RFQ DOCX after the runtime setting is corrected.
   - Confirm logs show `extract-entities` using `google/gemini-2.5-pro`.
   - Confirm the document status changes from `failed` to `analyzed`.

**Expected outcome**

The upload itself is not the root problem. The parser is working. The repeated failure is caused by entity extraction still using the stale Flash override instead of Gemini 2.5 Pro.

<lov-actions>
  <lov-open-history>View History</lov-open-history>
</lov-actions>

<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>