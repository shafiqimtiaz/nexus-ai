export async function readUiStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onTextDelta: (delta: string) => void;
    onToolStart: (id: string, name: string) => void;
    onToolInput: (id: string, input: unknown) => void;
    onToolOutput: (id: string, output: unknown) => void;
    onToolError: (id: string, errorText: string) => void;
    onError: (errorText: string) => void;
  }
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (raw: string) => {
    const payload = raw
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!payload || payload === "[DONE]") return;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }

    switch (event.type) {
      case "text-delta":
        handlers.onTextDelta(String(event.delta ?? ""));
        break;
      case "tool-input-start":
        handlers.onToolStart(String(event.toolCallId), String(event.toolName));
        break;
      case "tool-input-available":
        handlers.onToolInput(String(event.toolCallId), event.input);
        break;
      case "tool-output-available":
        handlers.onToolOutput(String(event.toolCallId), event.output);
        break;
      case "tool-input-error":
      case "tool-output-error":
        handlers.onToolError(
          String(event.toolCallId),
          String(event.errorText ?? "Tool call failed")
        );
        break;
      case "error":
        handlers.onError(String(event.errorText ?? "Something went wrong"));
        break;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      dispatch(block);
    }
  }
  if (buffer.trim()) dispatch(buffer);
}
