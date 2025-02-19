package com.sourcegraph.cody.api;

import com.intellij.openapi.diagnostic.Logger;
import com.sourcegraph.cody.UpdatableChat;
import com.sourcegraph.cody.chat.ChatMessage;
import com.sourcegraph.cody.vscode.CancellationToken;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

public class ChatUpdaterCallbacks implements CompletionsCallbacks {
  private static final Logger logger = Logger.getInstance(ChatUpdaterCallbacks.class);
  @NotNull private final UpdatableChat chat;
  @NotNull private final CancellationToken cancellationToken;
  @NotNull private final String prefix;
  private boolean gotFirstMessage = false;

  public ChatUpdaterCallbacks(
      @NotNull UpdatableChat chat,
      @NotNull CancellationToken cancellationToken,
      @NotNull String prefix) {
    this.chat = chat;
    this.cancellationToken = cancellationToken;
    this.prefix = prefix;
  }

  @Override
  public void onSubscribed() {
    logger.info("Subscribed to completions.");
  }

  @Override
  public void onData(@Nullable String data) {
    if (data == null || cancellationToken.isCancelled()) {
      return;
    }
    // print date/time and msg
    // logger.info(DateTimeFormatter.ofPattern("yyyy-MM-dd
    // HH:mm:ss.SSS").format(LocalDateTime.now()) + " Data received by callback: " + data);
    if (!gotFirstMessage) {
      chat.addMessageToChat(ChatMessage.createAssistantMessage(reformatBotMessage(data, prefix)));
      gotFirstMessage = true;
    } else {
      chat.updateLastMessage(ChatMessage.createAssistantMessage(reformatBotMessage(data, prefix)));
    }
  }

  @Override
  public void onError(@NotNull Throwable error) {
    if (cancellationToken.isCancelled()) {
      return;
    }
    String message = error.getMessage();
    chat.respondToErrorFromServer(message != null ? message : "");
    chat.finishMessageProcessing();
    logger.warn(error);
  }

  @Override
  public void onComplete() {
    logger.info("Streaming completed.");
    if (cancellationToken.isCancelled()) {
      return;
    }
    chat.finishMessageProcessing();
  }

  @Override
  public void onCancelled() {
    if (cancellationToken.isCancelled()) {
      return;
    }
    chat.finishMessageProcessing();
  }

  private static @NotNull String reformatBotMessage(@NotNull String text, @NotNull String prefix) {
    String STOP_SEQUENCE_REGEXP = "(H|Hu|Hum|Huma|Human|Human:)$";
    Pattern stopSequencePattern = Pattern.compile(STOP_SEQUENCE_REGEXP);

    String reformattedMessage = prefix + text.stripTrailing();

    Matcher stopSequenceMatcher = stopSequencePattern.matcher(reformattedMessage);

    if (stopSequenceMatcher.find()) {
      reformattedMessage = reformattedMessage.substring(0, stopSequenceMatcher.start());
    }

    return reformattedMessage;
  }
}
