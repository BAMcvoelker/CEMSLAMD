# Adapted from the original Sequential Learning App
# https://github.com/BAMresearch/SequentialLearningApp
import numpy as np
import pandas as pd
from scipy.spatial import distance_matrix
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, ConstantKernel
from sklearn.decomposition import PCA
from sklearn.pipeline import Pipeline

from slamd.common.error_handling import ValueNotSupportedException
from slamd.discovery.processing.experiment.experiment_postprocessor import ExperimentPostprocessor
from slamd.discovery.processing.experiment.experiment_preprocessor import ExperimentPreprocessor
from slamd.discovery.processing.experiment.models.slamd_random_forest import SlamdRandomForest
from slamd.discovery.processing.experiment.models.tuned_gaussian_process_regressor import TunedGaussianProcessRegressor
from slamd.discovery.processing.experiment.models.tuned_random_forest import TunedRandomForest
from slamd.discovery.processing.experiment.experiment_model import ExperimentModel

# Attention - suppressing expected Gaussian Regressor warnings
import warnings
from sklearn.exceptions import ConvergenceWarning
warnings.filterwarnings('ignore', category=ConvergenceWarning)


class ExperimentConductor:

    @classmethod
    def run(cls, exp):
        ExperimentPreprocessor.preprocess(exp)
        cls._fit_model_and_predict(exp)
        cls._calculate_utility(exp)
        cls._calculate_novelty(exp)

        return ExperimentPostprocessor.postprocess(exp)

    @classmethod
    def _fit_model_and_predict(cls, exp):
        regressor = cls._initialize_model(exp)

        predictions = pd.DataFrame(columns=exp.target_names, index=exp.index_predicted, dtype=np.float)
        uncertainties = pd.DataFrame(columns=exp.target_names, index=exp.index_predicted, dtype=np.float)
        for target in exp.target_names:
            # Train the model for every target with the corresponding rows and labels
            index_labelled = exp.targets_df.index[exp.targets_df[target].notnull()]
            index_unlabelled = exp.targets_df.index[exp.targets_df[target].isnull()]

            training_rows = exp.features_df.loc[index_labelled].values
            training_labels = exp.targets_df.loc[index_labelled, target].values.reshape(-1, 1)

            regressor.fit(training_rows, training_labels)

            # Predict the label for the remaining rows
            rows_to_predict = exp.features_df.loc[index_unlabelled].values
            prediction, uncertainty = regressor.predict(rows_to_predict, return_std=True)

            predictions.loc[index_unlabelled, target] = prediction
            uncertainties.loc[index_unlabelled, target] = uncertainty

            # Determine rows for which the current target is labelled, but others aren't
            index_only_curr_labelled = exp.index_partially_labelled.intersection(index_labelled)

            # Add these known values to the prediction with uncertainty 0, for the utility calculation
            predictions.loc[index_only_curr_labelled, target] = exp.targets_df.loc[index_only_curr_labelled, target]
            uncertainties.loc[index_only_curr_labelled, target] = 0

        exp.prediction = predictions
        exp.uncertainty = uncertainties

    @classmethod
    def _initialize_model(cls, exp):
        """
        Initialize the model given by the user. Return a sklearn Regressor.
        The model must be one of the entries defined in ExperimentModel.
        """
        if exp.model == ExperimentModel.RANDOM_FOREST.value:
            regressor = SlamdRandomForest()
        elif exp.model == ExperimentModel.GAUSSIAN_PROCESS.value:
            # Hyperparameters from previous implementation of the app (Jupyter notebook).
            kernel = ConstantKernel(1.0, (1e-3, 1e3)) * RBF(10, (1e-2, 1e2))
            regressor = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=9, random_state=42)
        elif exp.model == ExperimentModel.PCA_GAUSSIAN_PROCESS.value:
            # These hyperparameters were found to be potentially interesting by running local experiments.
            predictor = GaussianProcessRegressor(n_restarts_optimizer=3)
            pca = PCA(n_components=0.99)
            regressor = Pipeline([('pca', pca), ('pred', predictor)])
        elif exp.model == ExperimentModel.PCA_RANDOM_FOREST.value:
            predictor = SlamdRandomForest()
            pca = PCA(n_components=0.99)
            regressor = Pipeline([('pca', pca), ('pred', predictor)])
        elif exp.model in [ExperimentModel.TUNED_GAUSSIAN_PROCESS.value, ExperimentModel.TUNED_RANDOM_FOREST.value]:
            if len(exp.target_names) > 1:
                raise ValueNotSupportedException(
                    message=f'{exp.model} only supports one target column, got {len(exp.target_names)}')

            target = exp.target_names[0]
            index_labelled = exp.targets_df.index[exp.targets_df[target].notnull()]
            training_rows = exp.features_df.loc[index_labelled].values
            training_labels = exp.targets_df.loc[index_labelled, target].values.reshape(-1, 1)

            if exp.model == ExperimentModel.TUNED_GAUSSIAN_PROCESS.value:
                regressor = TunedGaussianProcessRegressor.find_best_model(training_rows, training_labels)
            else:
                regressor = TunedRandomForest.find_best_model(training_rows, training_labels)
        else:
            raise ValueNotSupportedException(message=f'Invalid model: {exp.model}')
        # Return the initialized model
        return regressor

    @classmethod
    def _calculate_utility(cls, exp):
        """
        The utility is a measure of "interest" in a given datapoint
        It is given by
        - The sum of properties that are to be maximized
        - The sum of the negative of properties that are to be minimized
        - The sum of uncertainties weighted by the curiosity - allowing the user to focus on datapoints that are
          uncertain in order to maximize information gain (explore) or ignore uncertain points altogether to focus
          on safe predictions (exploit)
        """
        # The strategy is always 'MLI (explore & exploit)' for this implementation
        # See the original app for other possibilities

        prediction_for_utility, uncertainty_for_utility = cls._process_predictions(exp)
        apriori_for_utility = cls._process_apriori(exp)

        exp.utility = apriori_for_utility + prediction_for_utility.sum(axis=1) + \
            exp.curiosity * uncertainty_for_utility.sum(axis=1)

    @classmethod
    def _process_predictions(cls, exp):
        # Clip, norm, and weigh predictions for utility calculation
        # Targets which should be minimized instead of maximized are also inverted for the utility calculation

        # Clip
        clipped_prediction = cls.clip_prediction(exp)

        # Norm - use 1 as standard deviation instead of 0 to avoid division by 0 (unlikely)
        labels_std = exp.targets_df.std(skipna=True).replace(0, 1)
        labels_mean = exp.targets_df.mean(skipna=True)
        normed_uncertainty = exp.uncertainty / labels_std
        normed_prediction = (clipped_prediction - labels_mean) / labels_std

        # Invert
        for (column, value) in zip(exp.target_names, exp.target_max_or_min):
            if value == 'min':
                normed_prediction[column] *= (-1)

        # Weigh
        for (target, weight) in zip(exp.target_names, exp.target_weights):
            normed_prediction[target] *= weight
            normed_uncertainty[target] *= weight

        return normed_prediction, normed_uncertainty

    @classmethod
    def _process_apriori(cls, exp):
        # Norm, weigh and if necessary invert apriori columns for utility calculation

        if len(exp.apriori_names) == 0:
            # Return plain 0 instead of array - numpy broadcasting will take care of it
            return 0

        # Norm - use 1 as standard deviation instead of 0 to avoid division by 0
        normed_apriori_df = exp.apriori_df.copy()
        apriori_std = normed_apriori_df.std().replace(0, 1)
        apriori_mean = normed_apriori_df.mean()
        normed_apriori_df = (normed_apriori_df - apriori_mean) / apriori_std

        apriori_for_predicted_rows = normed_apriori_df.loc[exp.index_predicted]

        # Invert
        for (column, value) in zip(exp.apriori_names, exp.apriori_max_or_min):
            if value == 'min':
                apriori_for_predicted_rows[column] *= (-1)

        # Weigh
        for (col, weight) in zip(exp.apriori_df.columns, exp.apriori_weights):
            apriori_for_predicted_rows[col] *= weight

        return apriori_for_predicted_rows.sum(axis=1)

    @classmethod
    def _calculate_novelty(cls, exp):
        """
        Calculates the novelty, a measure of how different predicted points are compared to known points.

        For each predicted point, the novelty is given as the distance to the nearest known point.
        All values are normalized by the largest distance in the end, producing values in [0, 1].
        """
        if exp.index_all_labelled.empty:
            # Novelty can only be calculated if there are points that are fully labelled
            return

        # Normalize first
        norm_features_df = exp.features_df.copy()
        features_std = norm_features_df.std().replace(0, 1)
        features_mean = norm_features_df.mean()
        norm_features_df = (norm_features_df - features_mean) / features_std

        features_of_predicted_rows = norm_features_df.loc[exp.index_predicted]
        features_of_known_rows = norm_features_df.loc[exp.index_all_labelled]

        distance = distance_matrix(features_of_predicted_rows, features_of_known_rows)
        min_distances = distance.min(axis=1)
        max_of_min_distances = min_distances.max()

        novelty_as_array = min_distances * (1 / max_of_min_distances)

        exp.novelty = pd.DataFrame(
            {'Novelty': novelty_as_array},
            index=exp.index_predicted
        )

    @classmethod
    def clip_prediction(cls, exp):
        clipped_prediction = exp.prediction.copy()
        for (target, max_or_min, threshold) in zip(exp.target_names, exp.target_max_or_min, exp.target_thresholds):
            if threshold is None:
                continue

            if max_or_min == 'min':
                clipped_prediction[target].clip(lower=threshold, inplace=True)
            else:
                clipped_prediction[target].clip(upper=threshold, inplace=True)

        return clipped_prediction
