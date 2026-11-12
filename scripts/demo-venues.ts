import { venueInputSchema, type VenueInput } from '../shared/marketplace-model';
import demo1 from '../content/venues/demo-1.json';
import demo2 from '../content/venues/demo-2.json';
import demo3 from '../content/venues/demo-3.json';
import demo4 from '../content/venues/demo-4.json';
import demo5 from '../content/venues/demo-5.json';
import demo6 from '../content/venues/demo-6.json';
import demo7 from '../content/venues/demo-7.json';
import demo8 from '../content/venues/demo-8.json';

// Keep the existing fixtures and editor checks on the same eight fictional venues.
export const demoVenues: VenueInput[] = [demo1, demo2, demo3, demo4, demo5, demo6, demo7, demo8].map(data => venueInputSchema.parse(data));
