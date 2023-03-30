import { head, last } from "lodash-es";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { getAssistantById, getPromptGeneratorOfAssistant, useChatStore, useMessageStore, useConnectionStore } from "@/store";
import { CreatorRole, Message } from "@/types";
import { countTextTokens, generateUUID } from "@/utils";
import Header from "./Header";
import EmptyView from "../EmptyView";
import MessageView from "./MessageView";
import MessageTextarea from "./MessageTextarea";
import MessageLoader from "../MessageLoader";
import DataStorageBanner from "../DataStorageBanner";

// The maximum number of tokens that can be sent to the OpenAI API.
// reference: https://platform.openai.com/docs/api-reference/completions/create#completions/create-max_tokens
const MAX_TOKENS = 4000;

const ChatView = () => {
  const connectionStore = useConnectionStore();
  const chatStore = useChatStore();
  const messageStore = useMessageStore();
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [showHeaderShadow, setShowHeaderShadow] = useState<boolean>(false);
  const chatViewRef = useRef<HTMLDivElement>(null);
  const currentChat = chatStore.currentChat;
  const messageList = messageStore.messageList.filter((message) => message.chatId === currentChat?.id);
  const lastMessage = last(messageList);

  // Toggle header shadow.
  useEffect(() => {
    const handleChatViewScroll = () => {
      setShowHeaderShadow((chatViewRef.current?.scrollTop || 0) > 0);
    };
    chatViewRef.current?.addEventListener("scroll", handleChatViewScroll);

    return () => {
      chatViewRef.current?.removeEventListener("scroll", handleChatViewScroll);
    };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (!chatViewRef.current) {
        return;
      }
      chatViewRef.current.scrollTop = chatViewRef.current.scrollHeight;
    });
  }, [currentChat, messageList.length, lastMessage?.isGenerated]);

  useEffect(() => {
    setTimeout(() => {
      if (!chatViewRef.current) {
        return;
      }
      if (!lastMessage) {
        return;
      }

      if (!lastMessage.isGenerated) {
        chatViewRef.current.scrollTop = chatViewRef.current.scrollHeight;
      }
    });
  }, [lastMessage?.isGenerated, lastMessage?.content]);

  useEffect(() => {
    if (
      currentChat?.connectionId === connectionStore.currentConnectionCtx?.connection.id &&
      currentChat?.databaseName === connectionStore.currentConnectionCtx?.database?.name
    ) {
      return;
    }

    // Auto select the first chat when the current connection changes.
    const chatList = chatStore.chatList.filter(
      (chat) =>
        chat.connectionId === connectionStore.currentConnectionCtx?.connection.id &&
        chat.databaseName === connectionStore.currentConnectionCtx?.database?.name
    );
    chatStore.setCurrentChat(head(chatList));
  }, [currentChat, connectionStore.currentConnectionCtx]);

  const sendMessageToCurrentChat = async () => {
    const currentChat = chatStore.getState().currentChat;
    if (!currentChat) {
      return;
    }
    if (isRequesting) {
      return;
    }

    setIsRequesting(true);
    const messageList = messageStore.getState().messageList.filter((message) => message.chatId === currentChat.id);
    let prompt = "";
    let tokens = 0;
    if (connectionStore.currentConnectionCtx?.database) {
      let schema = "";
      try {
        const tables = await connectionStore.getOrFetchDatabaseSchema(connectionStore.currentConnectionCtx?.database);
        for (const table of tables) {
          if (tokens < MAX_TOKENS / 2) {
            tokens += countTextTokens(schema + table.structure);
            schema += table.structure;
          }
        }
      } catch (error: any) {
        toast.error(error.message);
      }
      const promptGenerator = getPromptGeneratorOfAssistant(getAssistantById(currentChat.assistantId)!);
      prompt = promptGenerator(schema);
    }
    let formatedMessageList = [];
    for (let i = messageList.length - 1; i >= 0; i--) {
      const message = messageList[i];
      if (tokens < MAX_TOKENS) {
        tokens += countTextTokens(message.content);
        formatedMessageList.unshift({
          role: message.creatorRole,
          content: message.content,
        });
      }
    }
    formatedMessageList.unshift({
      role: CreatorRole.System,
      content: prompt,
    });
    const rawRes = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: formatedMessageList,
      }),
    });
    setIsRequesting(false);

    if (!rawRes.ok) {
      const res = await rawRes.json();
      toast.error(res.error.message);
      return;
    }
    const data = rawRes.body;
    if (!data) {
      toast.error("未返回数据");
      return;
    }

    const message: Message = {
      id: generateUUID(),
      chatId: currentChat.id,
      creatorId: currentChat.assistantId,
      creatorRole: CreatorRole.Assistant,
      createdAt: Date.now(),
      content: "",
      isGenerated: false,
    };
    messageStore.addMessage(message);

    const reader = data.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      if (value) {
        const char = decoder.decode(value);
        if (char) {
          message.content = message.content + char;
          messageStore.updateMessage(message.id, {
            content: message.content,
          });
        }
      }
      done = readerDone;
    }
    messageStore.updateMessage(message.id, {
      isGenerated: true,
    });
  };

  return (
    <main
      ref={chatViewRef}
      className="drawer-content relative w-full h-full max-h-full flex flex-col justify-start items-start overflow-y-auto bg-white"
    >
      <div className="sticky top-0 z-1 bg-white w-full flex flex-col justify-start items-start">
        <DataStorageBanner />
        <Header className={showHeaderShadow ? "shadow" : ""} />
      </div>
      <div className="p-2 w-full h-auto grow max-w-4xl py-1 px-4 sm:px-8 mx-auto">
        {messageList.length === 0 ? (
          <EmptyView className="mt-16" sendMessage={sendMessageToCurrentChat} />
        ) : (
          messageList.map((message) => <MessageView key={message.id} message={message} />)
        )}
        {isRequesting && <MessageLoader />}
      </div>
      <div className="sticky bottom-0 w-full max-w-4xl py-2 px-4 sm:px-8 mx-auto bg-white bg-opacity-80 backdrop-blur">
        <MessageTextarea disabled={isRequesting} sendMessage={sendMessageToCurrentChat} />
      </div>
    </main>
  );
};

export default ChatView;
