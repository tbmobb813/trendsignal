declare module 'google-trends-api' {
  interface TrendOptions {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string | string[];
    hl?: string;
    timezone?: number;
    category?: number;
    property?: string;
  }

  const googleTrends: {
    interestOverTime(options: TrendOptions, cb?: (err: unknown, results: string) => void): Promise<string>;
    interestByRegion(options: TrendOptions, cb?: (err: unknown, results: string) => void): Promise<string>;
    relatedQueries(options: TrendOptions, cb?: (err: unknown, results: string) => void): Promise<string>;
    relatedTopics(options: TrendOptions, cb?: (err: unknown, results: string) => void): Promise<string>;
    realTimeTrends(options: { geo: string; hl?: string; timezone?: number }, cb?: (err: unknown, results: string) => void): Promise<string>;
  };

  export default googleTrends;
}
