/// <reference path="../pb_data/types.d.ts" />

// Shared market-data collections (design §4):
//   symbol_profiles, price_cache, fx_rates
//
// Read rules: any authenticated user may list/view.
// Write rules: null (locked) => only the BFF superuser/service account can
// create/update/delete. A null API rule in PocketBase means "superuser only".
//
// NOTE: the v0.23 JSVM binding drops a `fields: [...]` array passed to the
// Collection constructor, so fields are attached via `collection.fields.add()`.
const READ_AUTHED = '@request.auth.id != ""';

function lockWrites(collection) {
  collection.listRule = READ_AUTHED;
  collection.viewRule = READ_AUTHED;
  collection.createRule = null; // superuser only
  collection.updateRule = null;
  collection.deleteRule = null;
}

migrate(
  (app) => {
    // --- symbol_profiles --------------------------------------------------
    // Sector/country/ratios; asset_type drives ETF allocation look-through;
    // sector_weightings holds the ETF sector breakdown (spike 3).
    const symbolProfiles = new Collection({ type: 'base', name: 'symbol_profiles' });
    symbolProfiles.fields.add(new TextField({ name: 'ticker', required: true, max: 32 }));
    symbolProfiles.fields.add(new TextField({ name: 'isin', required: false, max: 16 }));
    symbolProfiles.fields.add(new TextField({ name: 'name', required: true, max: 300 }));
    symbolProfiles.fields.add(new TextField({ name: 'exchange', required: false, max: 100 }));
    symbolProfiles.fields.add(
      new SelectField({
        name: 'asset_type',
        required: true,
        maxSelect: 1,
        values: ['stock', 'etf', 'other'],
      }),
    );
    symbolProfiles.fields.add(new TextField({ name: 'listing_currency', required: false, max: 8 }));
    symbolProfiles.fields.add(new TextField({ name: 'sector', required: false, max: 100 })); // null for ETFs
    symbolProfiles.fields.add(new TextField({ name: 'industry', required: false, max: 200 }));
    symbolProfiles.fields.add(new TextField({ name: 'country', required: false, max: 100 })); // null for ETFs
    symbolProfiles.fields.add(new NumberField({ name: 'market_cap', required: false }));
    symbolProfiles.fields.add(new NumberField({ name: 'pe_ratio', required: false }));
    symbolProfiles.fields.add(new NumberField({ name: 'beta', required: false }));
    symbolProfiles.fields.add(new NumberField({ name: 'dividend_yield', required: false }));
    symbolProfiles.fields.add(
      new JSONField({ name: 'sector_weightings', required: false, maxSize: 50000 }),
    ); // ETFs only
    symbolProfiles.fields.add(
      new SelectField({
        name: 'data_source',
        required: false,
        maxSelect: 1,
        values: ['yahoo', 'finnhub'],
      }),
    );
    symbolProfiles.fields.add(new DateField({ name: 'last_refreshed_at', required: false }));
    symbolProfiles.indexes = [
      'CREATE UNIQUE INDEX `idx_symbol_profiles_ticker` ON `symbol_profiles` (`ticker`)',
      'CREATE INDEX `idx_symbol_profiles_isin` ON `symbol_profiles` (`isin`)',
    ];
    lockWrites(symbolProfiles);
    app.save(symbolProfiles);

    // --- price_cache ------------------------------------------------------
    const priceCache = new Collection({ type: 'base', name: 'price_cache' });
    priceCache.fields.add(new TextField({ name: 'ticker', required: true, max: 32 }));
    priceCache.fields.add(new NumberField({ name: 'price', required: true }));
    priceCache.fields.add(new TextField({ name: 'currency', required: true, max: 8 }));
    priceCache.fields.add(new DateField({ name: 'as_of', required: false })); // from provider
    priceCache.fields.add(new DateField({ name: 'last_fetched_at', required: false })); // from us
    priceCache.fields.add(
      new SelectField({
        name: 'data_source',
        required: false,
        maxSelect: 1,
        values: ['yahoo', 'finnhub'],
      }),
    );
    priceCache.indexes = [
      'CREATE UNIQUE INDEX `idx_price_cache_ticker` ON `price_cache` (`ticker`)',
    ];
    lockWrites(priceCache);
    app.save(priceCache);

    // --- fx_rates ---------------------------------------------------------
    // Daily ECB reference rates, EUR base. rates is a JSON map { USD: 1.08, ... }.
    const fxRates = new Collection({ type: 'base', name: 'fx_rates' });
    fxRates.fields.add(new DateField({ name: 'date', required: true })); // YYYY-MM-DD
    fxRates.fields.add(new JSONField({ name: 'rates', required: true, maxSize: 50000 }));
    fxRates.indexes = ['CREATE UNIQUE INDEX `idx_fx_rates_date` ON `fx_rates` (`date`)'];
    lockWrites(fxRates);
    app.save(fxRates);
  },
  (app) => {
    for (const name of ['fx_rates', 'price_cache', 'symbol_profiles']) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch (_) {
        // already gone — ignore
      }
    }
  },
);
