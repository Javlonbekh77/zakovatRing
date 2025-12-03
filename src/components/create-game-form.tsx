'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { createGame } from '@/app/admin/actions';
import { Loader2, Send } from 'lucide-react';
import { Separator } from './ui/separator';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  mainQuestion: z.string().min(10, 'Question must be at least 10 characters.'),
  mainAnswer: z.string().min(1, 'Answer is required.'),
  letterQuestions: z.array(
    z.object({
      letter: z.string(),
      question: z.string().min(1, 'Question for the letter is required.'),
      answer: z.string().min(1, 'Answer for the letter is required.'),
    })
  ),
});

export default function CreateGameForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mainQuestion: '',
      mainAnswer: '',
      letterQuestions: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: 'letterQuestions',
  });

  const mainAnswerValue = form.watch('mainAnswer');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const uniqueLetters = [...new Set(mainAnswerValue.toUpperCase().replace(/[^A-Z]/g, ''))].sort();
    
    // Get current fields to preserve user input
    const existingFields = form.getValues('letterQuestions');
    const newFields = uniqueLetters.map(letter => {
        const existingField = existingFields.find(f => f.letter === letter);
        return existingField ? existingField : { letter, question: '', answer: '' };
    });
    
    // Avoid re-rendering if the letters haven't changed
    const currentLetters = fields.map(f => f.letter).join('');
    const newLettersString = newFields.map(f => f.letter).join('');
    
    if (currentLetters !== newLettersString) {
        replace(newFields);
    }
  }, [mainAnswerValue, replace, fields, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await createGame(values);
      // On success, the action redirects, so no need to do anything here.
    } catch (error) {
      if (error instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Error Creating Game',
          description: error.message,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'An unknown error occurred',
          description: 'Please try again.',
        });
      }
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="mainQuestion"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg">Main Question</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g., What is the capital of France?"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="mainAnswer"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg">Main Answer</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Paris" {...field} />
              </FormControl>
              <FormDescription>
                This will determine which letters need a specific question.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {isMounted && fields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Letter-Reveal Questions</CardTitle>
              <CardDescription>
                Provide a question and answer for each unique letter in your
                main answer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 rounded-lg border p-4">
                  <h3 className="font-headline text-xl font-bold text-primary">
                    Letter: "{field.letter}"
                  </h3>
                  <FormField
                    control={form.control}
                    name={`letterQuestions.${index}.question`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Question for letter "{fields[index].letter}"</FormLabel>
                        <FormControl>
                          <Input placeholder={`Question to reveal '${fields[index].letter}'`} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name={`letterQuestions.${index}.answer`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Answer for letter "{fields[index].letter}"</FormLabel>
                        <FormControl>
                          <Input placeholder={`Answer to reveal '${fields[index].letter}'`} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        
        <Separator />

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Create Game
        </Button>
      </form>
    </Form>
  );
}
