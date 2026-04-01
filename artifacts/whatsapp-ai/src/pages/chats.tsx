import { useState } from "react";
import { 
  useListChats, 
  useGetChat, 
  useListMessages, 
  useSendMessage,
  getListMessagesQueryKey,
  getListChatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Send, Bot, User, Search, Hash, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function Chats() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const queryClient = useQueryClient();

  const { data: chats } = useListChats({
    query: { refetchInterval: 5000 }
  });

  const { data: messages } = useListMessages(selectedChatId || "", {
    query: {
      enabled: !!selectedChatId,
      refetchInterval: 3000
    }
  });

  const { data: chatDetails } = useGetChat(selectedChatId || "", {
    query: {
      enabled: !!selectedChatId
    }
  });

  const sendMessage = useSendMessage();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedChatId) return;

    const tempId = `temp-${Date.now()}`;
    const newMsg = {
      id: tempId,
      chatId: selectedChatId,
      content: messageText,
      fromMe: true,
      timestamp: new Date().toISOString(),
      type: "text" as const
    };

    // Optimistic update
    queryClient.setQueryData(getListMessagesQueryKey(selectedChatId), (old: any) => {
      return old ? [...old, newMsg] : [newMsg];
    });

    sendMessage.mutate({ chatId: selectedChatId, data: { content: messageText } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(selectedChatId) });
        queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
      }
    });

    setMessageText("");
  };

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden animate-in fade-in">
      {/* Sidebar */}
      <div className="w-80 border-r border-border flex flex-col bg-card shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-bold tracking-tight mb-4">Conversations</h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input className="pl-9 bg-background border-border" placeholder="Search chats..." />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {chats?.map(chat => (
              <button
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={cn(
                  "w-full p-4 flex items-start gap-3 hover:bg-muted/50 text-left transition-colors",
                  selectedChatId === chat.id && "bg-muted"
                )}
                data-testid={`chat-item-${chat.id}`}
              >
                <Avatar className="w-10 h-10 border border-border">
                  <AvatarImage src={chat.profilePicUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {chat.isGroup ? <Hash className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium truncate text-sm">{chat.name || chat.phoneNumber}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                      {chat.lastMessageAt ? format(new Date(chat.lastMessageAt), 'HH:mm') : ''}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{chat.lastMessage}</p>
                </div>
                {chat.unreadCount > 0 && (
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                    {chat.unreadCount}
                  </div>
                )}
              </button>
            ))}
            {chats?.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No active conversations
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background relative">
        {selectedChatId ? (
          <>
            <div className="h-16 border-b border-border bg-card flex items-center px-6 shrink-0 shadow-sm z-10">
              <Avatar className="w-8 h-8 mr-3">
                <AvatarImage src={chatDetails?.profilePicUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {chatDetails?.isGroup ? <Hash className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-sm">{chatDetails?.name || chatDetails?.phoneNumber}</h3>
                <p className="text-xs text-muted-foreground">{chatDetails?.phoneNumber}</p>
              </div>
            </div>
            
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6 max-w-3xl mx-auto pb-4">
                {messages?.map(msg => {
                  const isMe = msg.fromMe;
                  return (
                    <div key={msg.id} className={cn("flex flex-col max-w-[80%]", isMe ? "ml-auto items-end" : "items-start")}>
                      <div className={cn(
                        "p-3 rounded-2xl",
                        isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm"
                      )}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        {msg.isAiGenerated && !isMe && <Bot className="w-3 h-3 text-primary" />}
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(msg.timestamp), 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="p-4 bg-card border-t border-border shrink-0">
              <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-center">
                <Input 
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a manual override message..." 
                  className="pr-12 bg-background border-border h-12 rounded-full"
                  data-testid="input-message"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="absolute right-1 w-10 h-10 rounded-full"
                  disabled={!messageText.trim() || sendMessage.isPending}
                  data-testid="button-send"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p>Select a conversation to view telemetry</p>
          </div>
        )}
      </div>
    </div>
  );
}
