import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { BarChart3, Lock } from 'lucide-react';

export default function Login() {
  const [location, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLocation('/dashboard');
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 p-4">
      <Card className="w-full max-w-md shadow-xl border-gray-200 dark:border-neutral-800">
        <CardHeader className="space-y-1 flex flex-col items-center text-center pb-8">
          <div className="w-12 h-12 bg-gradient-to-tr from-[#E4405F] to-[#833AB4] rounded-xl flex items-center justify-center text-white mb-4 shadow-lg">
            <BarChart3 size={24} />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Researcher Access</CardTitle>
          <CardDescription>
            Enter your credentials to manage Instagram Reels experiments
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="researcher@university.edu" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full bg-gradient-to-r from-[#E4405F] to-[#833AB4] hover:opacity-90 transition-opacity border-0 h-11 text-md font-medium" type="submit" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </CardFooter>
        </form>
        <div className="p-6 pt-0 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-1">
            <Lock size={12} /> Secure Research Environment
          </div>
        </div>
      </Card>
    </div>
  );
}
