'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createApiKey, revokeApiKey, type ApiKeyListItem } from './actions';
import { Copy, Key, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  initialKeys: ApiKeyListItem[];
}

export function ApiKeysClient({ initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    try {
      const result = await createApiKey(newKeyName);
      setNewKey(result.key);
      setKeys(prev => [
        {
          id: result.id,
          name: newKeyName,
          key_prefix: result.prefix,
          created_at: new Date().toISOString(),
          last_used_at: null,
          expires_at: null,
        },
        ...prev,
      ]);
      setNewKeyName('');
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await revokeApiKey(keyId);
      setKeys(prev => prev.filter(k => k.id !== keyId));
      toast({
        title: 'Key revoked',
        description: 'The API key has been revoked',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to revoke API key',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'API key copied to clipboard',
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div>
      <div className="mb-6">
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setNewKey(null);
            setNewKeyName('');
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Key className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {newKey ? 'API Key Created' : 'Create API Key'}
              </DialogTitle>
              <DialogDescription>
                {newKey
                  ? 'Copy this key now. You won\'t be able to see it again.'
                  : 'Give your API key a name to help you remember what it\'s for.'}
              </DialogDescription>
            </DialogHeader>

            {newKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm break-all">
                  {newKey}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(newKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={() => setIsCreateOpen(false)}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  placeholder="e.g., Claude Desktop, Personal MCP"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <DialogFooter>
                  <Button
                    onClick={handleCreate}
                    disabled={!newKeyName.trim() || isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Create Key'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {keys.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No API keys yet</h3>
          <p className="text-muted-foreground mb-4">
            Create an API key to start using the Idynic API or MCP server.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {key.key_prefix}...
                </TableCell>
                <TableCell>{formatDate(key.created_at)}</TableCell>
                <TableCell>{formatDate(key.last_used_at)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRevoke(key.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">Using your API key</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Add the key to your Claude Desktop configuration:
        </p>
        <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`{
  "mcpServers": {
    "idynic": {
      "command": "npx",
      "args": ["@idynic/mcp-server"],
      "env": {
        "IDYNIC_API_KEY": "idn_your_key_here"
      }
    }
  }
}`}
        </pre>
      </div>
    </div>
  );
}
