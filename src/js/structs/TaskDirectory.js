import _ from 'underscore';

import DirectoryItem from './DirectoryItem';
import List from './List';

class TaskDirectory extends List {
  constructor() {
    super(...arguments);

    // Replace list items instances of Node
    this.list = this.list.map(function (item) {
      if (item instanceof DirectoryItem) {
        return item;
      } else {
        return new DirectoryItem(item);
      }
    });
  }

  findFile(name) {
    return _.find(this.getItems(), function (file) {
      return file.getName() === name;
    });
  }

}

module.exports = TaskDirectory;
