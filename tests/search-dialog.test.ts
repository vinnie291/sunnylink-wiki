import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { closeSearch, getSearchOpen, getServerSearchOpen, openSearch, subscribeSearch } from '../lib/searchDialog';

afterEach(closeSearch);

test('an early button click remains open when the lazy dialog subscribes', () => {
    openSearch();
    let notifications = 0;
    const unsubscribe = subscribeSearch(() => notifications++);
    assert.equal(getSearchOpen(), true);
    assert.equal(getServerSearchOpen(), false);
    openSearch();
    assert.equal(notifications, 0);
    closeSearch();
    assert.equal(getSearchOpen(), false);
    assert.equal(notifications, 1);
    openSearch();
    assert.equal(getSearchOpen(), true);
    assert.equal(notifications, 2);
    unsubscribe();
    closeSearch();
    assert.equal(notifications, 2);
});
