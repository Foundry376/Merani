import Rx, { Disposable, Observable } from 'rx-lite';
import { Folder } from '../flux/models/folder';
import { Label } from '../flux/models/label';
import QuerySubscriptionPool from '../flux/models/query-subscription-pool';
import DatabaseStore from '../flux/stores/database-store';
import { QuerySubscription } from '../flux/models/query-subscription';
import { Model } from '../flux/models/model';
import ModelQuery from '../flux/models/query';
import MailspringStore from 'mailspring-store';
import { Category } from '../flux/models/category';
import { QueryResultSet } from '../flux/models/query-result-set';

interface ICategoryOperators {
  sort(): Observable<Category[]> & ICategoryOperators;
  categoryFilter(filter: (Category) => boolean): Observable<Category[]> & ICategoryOperators;
}

const CategoryOperators = {
  sort() {
    const obs = this.map(categories => {
      return categories.sort((catA, catB) => {
        let nameA = catA.displayName;
        let nameB = catB.displayName;

        // Categories that begin with [, like [Mailbox]/For Later
        // should appear at the bottom, because they're likely autogenerated.
        if (nameA[0] === '[') {
          nameA = `ZZZ${nameA}`;
        }
        if (nameB[0] === '[') {
          nameB = `ZZZ${nameB}`;
        }
        return nameA.localeCompare(nameB);
      });
    });
    return Object.assign(obs, CategoryOperators);
  },

  categoryFilter(filter: (Category) => boolean) {
    const obs = this.map(categories => categories.filter(filter));
    return Object.assign(obs, CategoryOperators);
  },
};

const CategoryObservables = {
  forAllAccounts() {
    const folders = Rx.Observable.fromQuery<Folder[]>(DatabaseStore.findAll<Folder>(Folder));
    const labels = Rx.Observable.fromQuery<Label[]>(DatabaseStore.findAll<Label>(Label));
    const joined = Rx.Observable.combineLatest<Category[], Category[], Category[]>(
      folders,
      labels,
      (f, l) => [].concat(f, l)
    );
    Object.assign(joined, CategoryOperators);
    return joined as Observable<Category[]> & ICategoryOperators;
  },

  forAccount(account) {
    const scoped = account ? q => q.where({ accountId: account.id }) : q => q;

    const folders = Rx.Observable.fromQuery(scoped(DatabaseStore.findAll<Folder>(Folder)));
    const labels = Rx.Observable.fromQuery(scoped(DatabaseStore.findAll<Label>(Label)));
    const joined = Rx.Observable.combineLatest(folders, labels, (f, l) => [].concat(f, l));
    Object.assign(joined, CategoryOperators);
    return joined as Observable<Category[]> & ICategoryOperators;
  },

  standard(account): Observable<Category[]> & ICategoryOperators {
    const observable = Rx.Observable.fromConfig('core.workspace.showImportant').flatMapLatest(
      showImportant => {
        return CategoryObservables.forAccount(account)
          .sort()
          .categoryFilter(cat => cat.isStandardCategory(showImportant));
      }
    );
    Object.assign(observable, CategoryOperators);
    return observable as Observable<Category[]> & ICategoryOperators;
  },

  user(account) {
    return CategoryObservables.forAccount(account)
      .sort()
      .categoryFilter(cat => cat.isUserCategory());
  },

  hidden(account) {
    return CategoryObservables.forAccount(account)
      .sort()
      .categoryFilter(cat => cat.isHiddenCategory());
  },
};

export const Categories = CategoryObservables;

// Attach a few global helpers

Rx.Observable.fromStore = store => {
  return Rx.Observable.create(observer => {
    const unsubscribe = store.listen(() => {
      observer.onNext(store);
    });
    observer.onNext(store);
    return Rx.Disposable.create(unsubscribe);
  });
};

// Takes a store that provides an {ObservableListDataSource} via `dataSource()`
// Returns an observable that provides array of selected items on subscription
Rx.Observable.fromListSelection = originStore => {
  return Rx.Observable.create(observer => {
    let dataSourceDisposable = null;
    const storeObservable = Rx.Observable.fromStore(originStore);

    const disposable = storeObservable.subscribe(() => {
      const dataSource = originStore.dataSource();
      const dataSourceObservable = Rx.Observable.fromStore(dataSource);

      if (dataSourceDisposable) {
        dataSourceDisposable.dispose();
      }

      dataSourceDisposable = dataSourceObservable.subscribe(() =>
        observer.onNext(dataSource.selection.items())
      );
      return;
    });
    const dispose = () => {
      if (dataSourceDisposable) {
        dataSourceDisposable.dispose();
      }
      disposable.dispose();
    };
    return Rx.Disposable.create(dispose);
  });
};

Rx.Observable.fromConfig = (configKey: string) => {
  return Rx.Observable.create(observer => {
    const disposable = AppEnv.config.onDidChange(configKey, () =>
      observer.onNext(AppEnv.config.get(configKey))
    );
    observer.onNext(AppEnv.config.get(configKey));
    return Rx.Disposable.create(disposable.dispose);
  });
};

Rx.Observable.fromAction = (action: any) => {
  return Rx.Observable.create(observer => {
    const unsubscribe = action.listen(arg => observer.onNext(arg));
    return Rx.Disposable.create(unsubscribe);
  });
};

Rx.Observable.fromQuery = <T extends Model | Model[]>(query: ModelQuery<T>) => {
  return Rx.Observable.create(observer => {
    const unsubscribe = QuerySubscriptionPool.add(query, result => observer.onNext(result));
    return Rx.Disposable.create(unsubscribe);
  });
};

Rx.Observable.fromNamedQuerySubscription = <T extends Model>(
  name: string,
  subscription: QuerySubscription<T>
) => {
  return Rx.Observable.create(observer => {
    const unsubscribe = QuerySubscriptionPool.addPrivateSubscription(name, subscription, result =>
      observer.onNext(result)
    );
    return Rx.Disposable.create(unsubscribe);
  });
};

declare global {
  namespace Rx {
    export interface ObservableStatic {
      fromStore<T extends MailspringStore>(store: T): Observable<T>;
      fromListSelection<T>(store: MailspringStore & { dataSource(): any }): Observable<T[]>;
      fromConfig<T>(configKey: string): Observable<T>;
      fromAction<T>(action: any): Observable<T>;
      fromQuery<T extends Model | Model[]>(query: ModelQuery<T>): Observable<T>;
      fromNamedQuerySubscription<T extends Model>(
        name: string,
        sub: QuerySubscription<T>
      ): Observable<T[] | QueryResultSet<T>>;
    }
  }
}
