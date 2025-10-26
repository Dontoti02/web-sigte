'use client';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { users } from '@/lib/data';
import type { User, Conversation, Message } from '@/lib/types';
import { SendHorizonal, Smile, ArrowLeft } from 'lucide-react';
import { useRole } from '@/hooks/use-role';

const createMockConversations = (currentUser: User): Conversation[] => {
    return users
      .filter(u => u.id !== currentUser.id && ['teacher', 'parent'].includes(u.role))
      .map((u, index) => {
        const mockMessages: Message[] = [
            {
                id: `m${index}-1`,
                senderId: u.id,
                senderName: u.name,
                recipientId: currentUser.id,
                content: `Hola ${currentUser.name}, ¿cómo estás?`,
                timestamp: '10:00 AM',
                isRead: false,
                avatar: u.avatar,
            },
            {
                id: `m${index}-2`,
                senderId: currentUser.id,
                senderName: currentUser.name,
                recipientId: u.id,
                content: '¡Hola! Todo bien por aquí, ¿y tú?',
                timestamp: '10:01 AM',
                isRead: true,
                avatar: currentUser.avatar,
            },
        ];

        return {
            id: `conv-${index}`,
            participant: {
                id: u.id,
                name: u.name,
                avatar: u.avatar,
            },
            messages: mockMessages,
        };
    });
};


export default function MensajesPage() {
    const { user: currentUser } = useRole();

    if (!currentUser) {
        return <div>Cargando...</div>;
    }

    const [conversations] = useState(() => createMockConversations(currentUser));
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(conversations.length > 0 ? conversations[0] : null);
    const [newMessage, setNewMessage] = useState('');

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '') return;
        // This is a mock, so we just log it
        console.log("Sending message:", newMessage);
        setNewMessage('');
        // In a real app, you would update the conversation state and send to backend
    }
  
    const handleSelectConversation = (conv: Conversation) => {
      setSelectedConversation(conv);
    }
  
    const handleBackToList = () => {
      setSelectedConversation(null);
    }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
        <h1 className="text-3xl font-bold mb-4">Portal de Comunicación</h1>
      <div className="flex-1 grid md:grid-cols-[300px_1fr] gap-4 border rounded-lg bg-card overflow-hidden">
        <div className={cn(
          "flex flex-col border-r",
          selectedConversation && "hidden md:flex"
        )}>
          <div className="p-4 border-b">
            <Input placeholder="Buscar conversaciones..." />
          </div>
          <ScrollArea className="flex-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                className={cn(
                  'w-full text-left p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors',
                  selectedConversation?.id === conv.id && 'bg-muted'
                )}
                onClick={() => handleSelectConversation(conv)}
              >
                <Avatar>
                  <AvatarImage src={conv.participant.avatar} />
                  <AvatarFallback>{conv.participant.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                    <p className="font-semibold">{conv.participant.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{conv.messages.at(-1)?.content}</p>
                </div>
              </button>
            ))}
          </ScrollArea>
        </div>

        <div className={cn(
            "flex flex-col",
            !selectedConversation && "hidden md:flex"
          )}>
          {selectedConversation ? (
            <>
              <div className="p-4 border-b flex items-center gap-3">
                 <Button variant="ghost" size="icon" className="md:hidden" onClick={handleBackToList}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                <Avatar>
                  <AvatarImage src={selectedConversation.participant.avatar} />
                  <AvatarFallback>{selectedConversation.participant.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <h2 className="font-semibold text-lg">{selectedConversation.participant.name}</h2>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                {selectedConversation.messages.map(msg => (
                    <div key={msg.id} className={cn("flex items-end gap-2", msg.senderId === currentUser.id ? 'justify-end' : 'justify-start')}>
                         {msg.senderId !== currentUser.id && <Avatar className="h-8 w-8"><AvatarImage src={msg.avatar} /></Avatar>}
                        <div className={cn("max-w-xs md:max-w-md p-3 rounded-xl", msg.senderId === currentUser.id ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                            <p>{msg.content}</p>
                            <p className="text-xs opacity-70 mt-1">{msg.timestamp}</p>
                        </div>
                    </div>
                ))}
                </div>
              </ScrollArea>
              <Separator />
              <div className="p-4 bg-background">
                <form onSubmit={handleSendMessage} className="relative">
                  <Input 
                    placeholder="Escribe un mensaje..." 
                    className="pr-20"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                    <Button type="button" variant="ghost" size="icon"><Smile className="h-5 w-5 text-muted-foreground" /></Button>
                    <Button type="submit" variant="ghost" size="icon"><SendHorizonal className="h-5 w-5 text-accent" /></Button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full p-4 text-center">
              <p className="text-muted-foreground">Selecciona una conversación para empezar a chatear.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

    