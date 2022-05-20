import { Router } from '../deps.ts';
import { request } from '../services/request.ts';
import { collectOffer, collectOfferPreviews } from '../services/offers.ts';

export const offersRouter = new Router()
  .get('/', async (context) => {
    const itemsPerPage = context.request.url.searchParams.get('itemsPerPage') || 10;
    const offset = context.request.url.searchParams.get('offset') || 0;
    const category = context.request.url.searchParams.get('category') || 0;
    const search = context.request.url.searchParams.get('search') || '';
    const offersResponse = await request(
      `https://www.dhv.de/db3/service/gebrauchtmarkt/anzeigen?suchbegriff=${search}&rubrik=${category}&land=0&itemsperpage=${itemsPerPage}&order=1&start=${offset}`,
    ).then((res) => res.json());
    const offersRawHtml = offersResponse.content;
    const offers = collectOfferPreviews(offersRawHtml);
    context.response.body = offers;
  })
  .get('/mine', async (context) => {
    const sessionId = await context.cookies.get('dhvsid');
    const meineAnzeigen = await request(
      'https://www.dhv.de/db3/service/gebrauchtmarkt/meineanzeigen',
      { sessionId },
    ).then((response) => response.json());
    const offersRawHtml = meineAnzeigen.content;
    const offers = collectOfferPreviews(offersRawHtml);
    context.response.body = offers;
  })
  .get('/:id', async (context) => {
    const id = context.params.id;
    const offerResponse = await request(`https://www.dhv.de/db3/service/gebrauchtmarkt/anzeige/id/${id}`).then((
      response,
    ) => response.json());
    const offerRawHtml = offerResponse.content;
    const offer = collectOffer(offerRawHtml, id);
    context.response.body = offer;
  })
  .post('/:id/contact', async (context) => {
    const id = context.params.id;
    const body = context.request.body();
    if (body.type !== 'json') {
      throw new Error('Expected form-data');
    }

    const requestFormData = await body.value;
    const { message, name, email, phone, sendToMe } = requestFormData;

    const formData = new FormData();
    formData.append('Nachricht', message);
    formData.append('Name', name);
    formData.append('Email', email);
    formData.append('Telefon', phone);
    formData.append('id', id);
    formData.append('sendToSender', sendToMe ? '1' : '0');
    formData.append('agbAccepted', '1');
    formData.append('formid', 'anbieter_kontakt');

    const contactResponse = await request('https://www.dhv.de/db3/service/gebrauchtmarkt/anbieterkontaktieren', {
      method: 'POST',
      body: formData,
    }).then(
      (response) => response.json(),
    );

    if (contactResponse.success === true && contactResponse.message) {
      context.response.body = contactResponse;
    } else {
      context.response.status = 400;
      context.response.body = {
        success: false,
        message: 'Da ist etwas schief gelaufen. Bitte versuche es erneut.',
      };
    }
  });
