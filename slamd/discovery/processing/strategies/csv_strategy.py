from werkzeug.utils import secure_filename
from pandas import read_csv

from slamd.common.error_handling import ValueNotSupportedException
from slamd.discovery.processing.models.dataset import Dataset
from slamd.discovery.processing.discovery_persistence import DiscoveryPersistence


class CsvStrategy:

    @classmethod
    def create_dataset(cls, file_data):
        # Generate a safe filename for the new dataset
        file_name = secure_filename(file_data.filename)

        if file_name == 'temporary.csv':
            raise ValueNotSupportedException('You cannot use the name temporary for your dataset!')
        return Dataset(name=file_name, dataframe=read_csv(file_data))

    @classmethod
    def save_dataset(cls, dataset):
        DiscoveryPersistence.save_dataset(dataset)