import { supabase } from '../lib/supabase';

export interface Quote {
  text: string;
  author: string;
  category?: string;
  language?: string;
  date_added?: string;
}

/**
 * Fetches a daily quote from our database or an external API
 * @param dateKey A unique key for the day (YYYY-MM-DD format)
 * @returns Promise<Quote>
 */
export const fetchDailyQuote = async (dateKey: string): Promise<Quote> => {
  try {
    // First, try to get the quote from our local database
    const { data: localQuote, error: localError } = await supabase
      .from('daily_quotes')
      .select('*')
      .eq('date_key', dateKey)
      .single();

    if (localQuote && !localError) {
      return {
        text: localQuote.text,
        author: localQuote.author,
        category: localQuote.category || 'general',
        language: localQuote.language || 'fa',
        date_added: localQuote.created_at
      };
    }

    // If not found locally, fetch from an external API
    const quote = await fetchQuoteFromExternalAPI();
    
    // Save to local database for future use
    await saveQuoteToDatabase(dateKey, quote);
    
    return quote;
  } catch (error) {
    console.error('Error fetching daily quote:', error);
    // Return a fallback quote in case of error
    return {
      text: "الصبر مفتاح الفرج",
      author: "الامام علي عليه السلام",
      category: "fallback",
      language: "fa"
    };
  }
};

/**
 * Fetches a quote from an external API
 * @returns Promise<Quote>
 */
const fetchQuoteFromExternalAPI = async (): Promise<Quote> => {
  try {
    // Using a free API for quotes - this is just an example
    // In production, you might want to use a more reliable service
    const response = await fetch('https://api.quotable.io/random');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      text: data.content,
      author: data.author,
      category: data.tags && data.tags.length > 0 ? data.tags[0] : 'general',
      language: 'en' // quotable.io provides English quotes
    };
  } catch (error) {
    console.error('Error fetching from external API:', error);
    // Return a Persian fallback quote
    return {
      text: " knowledge is of two kinds: that which comes from the senses and that which is independent of the senses.",
      author: "Imam Ali ibn Abi Talib (AS)",
      category: "wisdom",
      language: "en"
    };
  }
};

/**
 * Saves a quote to the local database
 * @param dateKey The date key for the quote
 * @param quote The quote to save
 */
const saveQuoteToDatabase = async (dateKey: string, quote: Quote): Promise<void> => {
  try {
    const { error } = await supabase
      .from('daily_quotes')
      .insert([
        {
          date_key: dateKey,
          text: quote.text,
          author: quote.author,
          category: quote.category,
          language: quote.language,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Error saving quote to database:', error);
    }
  } catch (error) {
    console.error('Error saving quote:', error);
  }
};

/**
 * Generates a date key for the current day
 * @returns string in YYYY-MM-DD format
 */
export const getQuoteDateKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
