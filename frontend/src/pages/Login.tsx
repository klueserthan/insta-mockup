import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { BarChart3, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [, setLocation] = useLocation();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const { loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isRegister) {
      registerMutation.mutate(
        { email, password, name, lastname },
        {
          onSuccess: () => {
            toast({
              title: "Account created",
              description: "Welcome to InstaReel Research!",
            });
            setLocation('/dashboard');
          },
        }
      );
    } else {
      loginMutation.mutate(
        { email, password },
        {
          onSuccess: () => {
            toast({
              title: "Welcome back",
              description: "You have been logged in successfully.",
            });
            setLocation('/dashboard');
          },
        }
      );
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 p-4">
      <Card className="w-full max-w-md shadow-xl border-gray-200 dark:border-neutral-800">
        <CardHeader className="space-y-1 flex flex-col items-center text-center pb-8">
          <div className="w-12 h-12 bg-gradient-to-tr from-[#E4405F] to-[#833AB4] rounded-xl flex items-center justify-center text-white mb-4 shadow-lg">
            <BarChart3 size={24} />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isRegister ? 'Create Account' : 'Researcher Access'}
          </CardTitle>
          <CardDescription>
            {isRegister 
              ? 'Register to start managing Instagram Reels experiments'
              : 'Enter your credentials to manage Instagram Reels experiments'
            }
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {isRegister && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">First Name</Label>
                  <Input 
                    id="name" 
                    type="text" 
                    placeholder="Jane" 
                    required 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastname">Last Name</Label>
                  <Input 
                    id="lastname" 
                    type="text" 
                    placeholder="Smith" 
                    required 
                    value={lastname}
                    onChange={(e) => setLastname(e.target.value)}
                    data-testid="input-lastname"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="researcher@university.edu" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              className="w-full bg-gradient-to-r from-[#E4405F] to-[#833AB4] hover:opacity-90 transition-opacity border-0 h-11 text-md font-medium" 
              type="submit" 
              disabled={isLoading}
              data-testid="button-submit"
            >
              {isLoading 
                ? (isRegister ? 'Creating Account...' : 'Signing In...') 
                : (isRegister ? 'Create Account' : 'Sign In')
              }
            </Button>
            <Button 
              type="button"
              variant="ghost" 
              className="w-full" 
              onClick={() => setIsRegister(!isRegister)}
              data-testid="button-toggle-mode"
            >
              {isRegister 
                ? 'Already have an account? Sign In' 
                : "Don't have an account? Register"
              }
            </Button>
            {process.env.NODE_ENV !== 'production' && (
              <Button 
                type="button"
                variant="outline" 
                className="w-full border-dashed border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950" 
                onClick={() => {
                  loginMutation.mutate(
                    { email: 'test@research.edu', password: 'password123' },
                    {
                      onSuccess: () => {
                        toast({
                          title: "Dev Login",
                          description: "Logged in as test user.",
                        });
                        setLocation('/dashboard');
                      },
                    }
                  );
                }}
                disabled={isLoading}
                data-testid="button-dev-login"
              >
                Dev Login (test@research.edu)
              </Button>
            )}
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
